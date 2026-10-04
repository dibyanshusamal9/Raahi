"""Core turn endpoint — transport-agnostic.
IVR and WhatsApp routers call this after they've handled STT."""
from __future__ import annotations
import time, json, re, difflib
from fastapi import APIRouter, HTTPException
from ..models.session import TurnIn, TurnOut
from ..models.beneficiary import BeneficiaryPatch
from ..db import (phone_hash, upsert_beneficiary, patch_beneficiary,
                  start_session, record_turn, bump_session, close_session,
                  freeze_recommendation, q)
from ..services.extractor import extract
from ..services.next_question import pick_next
from ..services import persona
from ..services.ranker import recommend, stability_key
from ..services.composer import compose, TEMPLATES as _COMPOSER_TEMPLATES
from ..services.pack import send_pack
from ..services.lifecycle import create_counselled
from ..services.i18n import localize, to_english, seed as i18n_seed
from ..services.translit import to_latin as _to_latin, has_indic as _has_indic
from ..services.next_question import SEED as _QUESTION_SEED
from ..settings import settings
from ..logging import log

router = APIRouter(prefix="/session", tags=["session"])

# Load the human translations of the fixed questions into the translation
# cache so the core languages are instant and idiomatic.
i18n_seed(_QUESTION_SEED)

# RAAHI's acknowledgements, the "let me check" line before the results and the
# short consent reminder live in services/persona.py.

# Languages whose results message is written natively (no translation).
COMPOSER_LANGS = tuple(_COMPOSER_TEMPLATES)


async def _in_language(line: str, lang: str | None) -> str:
    """A persona line comes back native for the core languages and in English
    otherwise; translate the English one like every other prompt."""
    lang = (lang or "en").lower()
    if not line or lang in persona.NATIVE:
        return line
    return await localize(line, lang)


# In-memory turn context per session (asked fields, last question).
_ASKED: dict[str, set[str]] = {}
_LAST_Q: dict[str, tuple[str, str]] = {}    # session_id → (field, text)
_FINALIZING: set[str] = set()               # sessions that said "let me check"
                                            # and owe results on the next call


def _get_or_create_session(inp: TurnIn) -> tuple[dict, dict]:
    phash = inp.phone_hash or (phone_hash(inp.phone) if inp.phone else None)
    if not phash:
        raise HTTPException(400, "phone or phone_hash required")
    b = upsert_beneficiary(phash, inp.language)

    # Resume the most recent active session for this beneficiary, if any.
    rows = q("select * from sessions where beneficiary_id=%s::uuid and status='active' "
             "order by started_at desc limit 1", (b["id"],))
    if rows:
        s = rows[0]
    else:
        s = start_session(b["id"], inp.transport)
        _ASKED[s["id"]] = set()
    _ASKED.setdefault(s["id"], set())
    return b, s


@router.post("/turn", response_model=TurnOut)
async def turn(inp: TurnIn) -> TurnOut:
    t0 = time.perf_counter()
    b, s = _get_or_create_session(inp)

    # Monotonic per-session turn number. Do NOT derive this from
    # sessions.turn_count: that only advances once consent is obtained, so the
    # greeting / consent / name turns would all reuse turn_no=1 and be dropped
    # by voice_turns' ON CONFLICT DO NOTHING — losing them from the transcript.
    _row = q("select coalesce(max(turn_no), 0) + 1 as n from voice_turns where session_id=%s::uuid",
             (s["id"],))
    turn_no = _row[0]["n"] if _row else 1
    heard = (inp.text or "").strip()

    # Phase 2 of the two-phase finish: we already said "let me check" last turn.
    # Now actually rank and return the results, ignoring whatever this trigger
    # turn contained.
    if s["id"] in _FINALIZING:
        _FINALIZING.discard(s["id"])
        ranked = recommend(b["id"], top=10)
        top3 = ranked[:3]
        return await _finish(b, s, top3, ranked, turn_no, t0, "", "", {})
    # For languages the rule-based extractor doesn't natively cover (everything
    # outside en/hi/bn/ta/mr) translate the answer to English first, so the same
    # rules and keyword tables apply. Native languages pass through unchanged.
    heard_en = await to_english(heard, b["language"]) if heard else heard

    # Extract every field the message mentions — not just the last asked one.
    # A beneficiary who volunteers "I live in Delhi and I studied till 12th"
    # should have both district and education captured in one go.
    patch_dict: dict = {}
    acked: str | None = None   # the question this answer filled, to acknowledge it
    last_q = _LAST_Q.get(s["id"])
    if heard:
        question_ctx = last_q[1] if last_q else "Please tell me about yourself."
        patch = await extract(question=question_ctx, answer=heard_en, language=b["language"])
        if patch is None and last_q:
            q_text = _rephrase(last_q[1])
            q_local = await localize(q_text, b["language"])
            record_turn(s["id"], turn_no, asked=q_text, asked_local=q_local,
                        heard_text=heard, heard_en=heard_en, extractor_patch=json.dumps({}),
                        latency_ms=int((time.perf_counter() - t0) * 1000))
            return TurnOut(session_id=s["id"], beneficiary_id=b["id"],
                           done=False, next_question=q_local)
        if patch is not None:
            patch_dict = patch.model_dump(exclude_none=True)
            # Validate before writing: a district we have no data for, or an
            # out-of-range age, is a wrong input — drop it so the field stays
            # unfilled and the caller is asked again with a clear message.
            rejected = _validate_patch(patch_dict)
            if patch_dict:
                b = patch_beneficiary(b["id"], patch_dict)
                for field in patch_dict.keys():
                    _ASKED[s["id"]].add(field)
            # If the caller's answer to THIS question was rejected as invalid,
            # tell them plainly and re-ask.
            if last_q and last_q[0] in rejected:
                q_text = rejected[last_q[0]]
                q_local = await localize(q_text, b["language"])
                record_turn(s["id"], turn_no, asked=q_text, asked_local=q_local,
                            heard_text=heard, heard_en=heard_en,
                            extractor_patch=json.dumps(patch_dict),
                            latency_ms=int((time.perf_counter() - t0) * 1000))
                return TurnOut(session_id=s["id"], beneficiary_id=b["id"],
                               done=False, next_question=q_local)

        # Re-ask ONCE if the answer produced no useful fields at all.
        # A "useful field" = anything other than the language echo. If the
        # extractor got even one real field (age from "22" or education from
        # "class 12"), we move on to the next question.
        if last_q:
            asked_field = last_q[0]
            useful = {k: v for k, v in patch_dict.items()
                      if k != "language" and v not in (None, "", [])}

            if asked_field == "consent":
                positive = _is_affirmative(heard) or _is_affirmative(heard_en)
                if positive:
                    _ASKED[s["id"]].add("consent")
                    useful["__consented__"] = True
                    acked = "consent"

            reask_marker = f"__reasked__{asked_field}"
            if not useful and asked_field != "consent" and reask_marker not in _ASKED[s["id"]]:
                _ASKED[s["id"]].add(reask_marker)
                q_text = _reask(last_q[1], asked_field, b["language"])
                q_local = await localize(q_text, b["language"])
                # keep _LAST_Q pointing at the same field so we know what to score next turn
                record_turn(s["id"], turn_no, asked=q_text, asked_local=q_local,
                            heard_text=heard, heard_en=heard_en,
                            extractor_patch=json.dumps(patch_dict),
                            latency_ms=int((time.perf_counter() - t0) * 1000))
                return TurnOut(session_id=s["id"], beneficiary_id=b["id"],
                               done=False, next_question=q_local)

            # Progress: only mark the ASKED field as satisfied when the answer
            # actually filled it, OR when we've already re-asked once. Otherwise
            # a caller who answers "smartphone" to the category question would
            # cause the category slot to be silently marked done.
            if asked_field in useful or reask_marker in _ASKED[s["id"]]:
                _ASKED[s["id"]].add(asked_field)
            if asked_field in useful:
                acked = asked_field

    # If we haven't yet obtained consent, gate.
    if "consent" not in _ASKED[s["id"]]:
        field, question = pick_next({}, _ASKED[s["id"]], b["language"])   # will return consent
        if last_q and last_q[0] == "consent":
            # The full welcome was already said; ask again briefly.
            question = persona.CONSENT_AGAIN["en"]
            q_local = await _in_language(persona.consent_again(b["language"]), b["language"])
        else:
            q_local = await localize(question, b["language"])
        _LAST_Q[s["id"]] = (field, question)   # keep ENGLISH for extraction context
        record_turn(s["id"], turn_no, asked=question, asked_local=q_local,
                    heard_text=heard, heard_en=heard_en,
                    extractor_patch=json.dumps(patch_dict),
                    latency_ms=int((time.perf_counter() - t0) * 1000))
        return TurnOut(session_id=s["id"], beneficiary_id=b["id"],
                       done=False, next_question=q_local)

    # Otherwise rank now to see if top-3 is stable.
    ranked = recommend(b["id"], top=10)
    top3 = ranked[:3]
    prev_key = (s.get("last_top3") or [])
    prev = [row["qp_code"] for row in (json.loads(prev_key) if isinstance(prev_key, str) else prev_key)] if prev_key else []
    key = stability_key(top3)
    stable = (key == prev and len(top3) == 3)
    s = bump_session(s["id"], top3, stable)

    reached_max = s["turn_count"] >= settings.interview_max_turns
    # Cover EVERY question the interview asks — the panel says "STILL NEEDED"
    # for these until they're filled, so the interview should not end while
    # any of them is missing. Hard cap `interview_max_turns` still applies.
    all_filled = (
        bool(b.get("name"))
        and bool(b.get("home_district"))
        and b.get("age") is not None
        and b.get("education_class") is not None
        and bool(b.get("interests") or b.get("aspiration"))
        and b.get("mobility_km") is not None
        and b.get("has_smartphone") is not None
        and b.get("self_employ_ok") is not None
        and bool(b.get("social_category"))
    )
    should_finish = reached_max or (all_filled and len(top3) >= 1)

    # Two-phase finish: first say "let me check" and STOP, without running the
    # ranker. The frontend plays that line, then auto-sends one more turn which
    # lands in the `_FINALIZING` branch at the top of the next request and
    # returns the actual results. This makes the wait feel like a person
    # checking, instead of a long silent pause before the answer.
    if should_finish and s["id"] not in _FINALIZING:
        _FINALIZING.add(s["id"])
        filler = await _in_language(persona.filler(b, b["language"]), b["language"])
        record_turn(s["id"], turn_no, asked=persona.filler(b, "en"), asked_local=filler,
                    heard_text=heard, heard_en=heard_en,
                    extractor_patch=json.dumps(patch_dict),
                    latency_ms=int((time.perf_counter() - t0) * 1000))
        return TurnOut(session_id=s["id"], beneficiary_id=b["id"],
                       done=False, finalizing=True, next_question=filler)

    if should_finish:
        return await _finish(b, s, top3, ranked, turn_no, t0, heard, heard_en, patch_dict)

    # Pick next question
    nxt = pick_next(b, _ASKED[s["id"]], b["language"])
    if not nxt:
        return await _finish(b, s, top3, ranked, turn_no, t0, heard, heard_en, patch_dict)

    field, question = nxt
    _LAST_Q[s["id"]] = (field, question)   # keep ENGLISH for extraction context
    # Acknowledge the answer just given (by name, once we know it), then ask —
    # so it sounds like a conversation, not a form.
    lead = await _in_language(persona.ack(acked, b, b["language"]), b["language"])
    q_local = await localize(question, b["language"])
    spoken = f"{lead} {q_local}".strip()
    record_turn(s["id"], turn_no, asked=f"{persona.ack(acked, b, 'en')} {question}".strip(),
                asked_local=spoken,
                heard_text=heard, heard_en=heard_en,
                extractor_patch=json.dumps(patch_dict),
                latency_ms=int((time.perf_counter() - t0) * 1000))
    return TurnOut(session_id=s["id"], beneficiary_id=b["id"],
                   done=False, next_question=spoken,
                   top3=[dict(r) for r in top3])


async def _finish(b, s, top3, ranked, turn_no, t0, heard, heard_en, patch_dict) -> TurnOut:
    lang = (b["language"] or "en").lower()
    # The "let me check" filler was already spoken in phase 1, so the result is
    # just the pathways. compose() renders native for en/hi/bn/ta/mr, else English.
    composed = await compose(top3, lang, b)
    if lang in COMPOSER_LANGS:           # written natively, no translation needed
        composer_text = composed
    else:
        composer_text = await localize(composed, lang)
    composer_en = await compose(top3, "en", b)

    signals_used = {"demand_row_ids": _demand_ids_used(b["home_district"], top3)}
    profile_snap = {k: v for k, v in b.items() if not k.startswith("_")}
    rec = freeze_recommendation(s["id"], b["id"], profile_snap,
                                [dict(r) for r in top3],
                                signals_used, composer_text)
    # Create the counselled enrollment on the top pick — mobiliser can flip it.
    # `top3` can be empty if the interview hit the hard turn cap before any
    # qualification matched (or the corpus is empty), so guard the index.
    if top3 and top3[0].get("qualification_id"):
        create_counselled(b["id"], top3[0]["qualification_id"],
                          top3[0].get("centre_id"), owner="system")
    sent = False
    if b.get("phone_hash"):
        # No plaintext phone here in dev; real IVR path passes phone via inp.phone.
        sent = False
    close_session(s["id"], "completed")
    record_turn(s["id"], turn_no, asked=composer_en, asked_local=composer_text,
                heard_text=heard, heard_en=heard_en,
                extractor_patch=json.dumps(patch_dict),
                latency_ms=int((time.perf_counter() - t0) * 1000))
    _ASKED.pop(s["id"], None)
    _LAST_Q.pop(s["id"], None)
    _FINALIZING.discard(s["id"])
    return TurnOut(session_id=s["id"], beneficiary_id=b["id"], done=True,
                   next_question=None, top3=[dict(r) for r in top3],
                   composer_text=composer_text,
                   recommendation_id=rec["id"], pack_sent=sent)


@router.get("/{session_id}/transcript")
async def transcript(session_id: str):
    """Full saved conversation for one session — every question the system
    asked (in the caller's language and in English) and every answer the
    caller gave (native script + English gloss), in order, plus the frozen
    recommendation. This is the record an officer reads back."""
    srows = q("select * from sessions where id=%s::uuid", (session_id,))
    if not srows:
        raise HTTPException(404, "session not found")
    sess = srows[0]
    b = q("select * from beneficiaries where id=%s::uuid", (sess["beneficiary_id"],))
    ben = b[0] if b else {}

    turns = q("select turn_no, asked, asked_local, heard_text, heard_en, "
              "latency_ms, created_at from voice_turns "
              "where session_id=%s::uuid order by turn_no", (session_id,))
    # Within one stored turn, `heard_text` is the caller's reply to the PREVIOUS
    # question and `asked` is the NEXT question the system then posed — so the
    # true chronological order is heard first, then asked.
    convo = []
    for t in turns:
        if t.get("heard_text"):
            convo.append({"role": "beneficiary",
                          "text": t.get("heard_text"),
                          "text_en": t.get("heard_en"), "turn": t["turn_no"]})
        if t.get("asked") or t.get("asked_local"):
            convo.append({"role": "raahi",
                          "text": t.get("asked_local") or t.get("asked"),
                          "text_en": t.get("asked"), "turn": t["turn_no"]})

    rec = q("select top3, composer_text, created_at from recommendations "
            "where session_id=%s::uuid order by created_at desc limit 1", (session_id,))

    return {
        "session_id": session_id,
        "status": sess.get("status"),
        "language": ben.get("language"),
        "beneficiary": {k: v for k, v in ben.items()
                        if k in ("name", "home_district", "age", "education_class",
                                 "education_note", "interests", "aspiration",
                                 "mobility_km", "has_smartphone", "self_employ_ok",
                                 "social_category")},
        "conversation": convo,
        "recommendation": (rec[0] if rec else None),
    }


def _demand_ids_used(district: str | None, top3: list[dict]) -> list[str]:
    if not district or not top3:
        return []
    codes = [t["qp_code"] for t in top3 if t.get("qp_code")]
    if not codes:
        return []
    rows = q(
        "select id from demand_signals where district=%s and qp_code = any(%s) "
        "and evidence_date >= current_date - interval '180 days'",
        (district, codes),
    )
    return [str(r["id"]) for r in rows]


# Affirmative words across the pilot languages. Indic entries are matched by
# containment, NOT by a \b-anchored regex: Python's \b sits between \w and \W,
# and Indic combining marks (virama, matras, chandrabindu) are Mn/Mc — not \w —
# so \bহ্যাঁ\b can never match. That bug used to strand Bengali and Tamil
# callers at the consent gate forever.
# The welcome ends "Shall we begin?", so "let's start" counts as a yes too.
_AFFIRMATIVE_ASCII = ("yes", "yeah", "yep", "yup", "sure", "ok", "okay",
                      "haan", "han", "ha", "jee", "ji", "hoy", "aam", "aan",
                      "chalo", "chaliye", "shuru", "start", "begin", "go ahead")
_AFFIRMATIVE_NATIVE = ("हाँ", "हा", "जी", "हां", "होय",          # hi / mr
                       "चलिए", "चलो", "शुरू", "चला",
                       "হ্যাঁ", "হ্যা", "হাঁ", "জি", "চলুন",     # bn
                       "ஆம்", "ஆமாம்", "சரி", "தொடங்கலாம்")      # ta


def _is_affirmative(text: str) -> bool:
    t = (text or "").lower()
    if any(re.search(rf"\b{w}\b", t) for w in _AFFIRMATIVE_ASCII):
        return True
    return any(w in text for w in _AFFIRMATIVE_NATIVE)


def _served_districts() -> set[str]:
    """Districts we actually have training centres or demand data for. Cached
    for the process; small and rarely-changing."""
    global _SERVED_CACHE
    if _SERVED_CACHE is None:
        rows = q("select distinct district from training_centres "
                 "union select distinct district from demand_signals")
        _SERVED_CACHE = {(r["district"] or "").strip().lower() for r in rows}
    return _SERVED_CACHE


_SERVED_CACHE: set[str] | None = None


# Well-known districts whose spoken form doesn't transliterate close enough to
# the table's spelling for a fuzzy match — colonial English spellings and names
# with heavy glide/schwa loss. Written here as native-script or common-variant
# spelling -> canonical district; the keys are folded through _norm_key at load
# so they match caller input under the exact same rules.
_ALIAS_RAW = {
    "लखनऊ": "Lucknow",
    "इंदौर": "Indore",
    "जयपुर": "Jaipur",
    "बेंगलुरु": "Bengaluru", "Bangalore": "Bengaluru",
    "गुरुग्राम": "Gurugram", "Gurgaon": "Gurugram",
    "Calcutta": "Kolkata",
    "Bombay": "Mumbai",
    "Madras": "Chennai",
    "Poona": "Pune",
    "Cawnpore": "Kanpur",
    "Allahabad": "Prayagraj",
    "Banaras": "Varanasi", "Benares": "Varanasi",
    "Trivandrum": "Thiruvananthapuram",
    "Vizag": "Visakhapatnam",
    "கோயம்புத்தூர்": "Coimbatore",
}


def _collapse_vowels(s: str) -> str:
    """Collapse runs of the same vowel so schwa/long-vowel drift lines up:
    'patanaa' -> 'patana', 'kolokaata' -> 'kolokata'."""
    return re.sub(r"([aeiou])\1+", r"\1", s)


def _norm_key(name: str) -> str:
    """Fold a district name to a script-agnostic comparison key: transliterate
    any Indic text to Latin (Hindi schwa deletion happens there), lowercase,
    keep only a-z, and collapse doubled vowels. Applied to both the reference
    names and the caller input, so the two stay comparable.
    'पटना' -> 'patna', 'Bhagalpur' -> 'bhagalpur'."""
    s = (name or "").strip()
    if _has_indic(s):
        s = _to_latin(s)
    return _collapse_vowels(re.sub(r"[^a-z]", "", s.lower()))


# Alias keys folded through _norm_key so they match caller input identically.
_DISTRICT_ALIASES = {_norm_key(k): v for k, v in _ALIAS_RAW.items() if _norm_key(k)}


_DISTRICT_INDEX: list[tuple[str, dict]] | None = None


def _district_index() -> list[tuple[str, dict]]:
    """(normalized_key, row) for every reference district. Cached per process;
    the table is small and rarely changes."""
    global _DISTRICT_INDEX
    if _DISTRICT_INDEX is None:
        rows = q("select district, state, latitude, longitude from indian_districts")
        _DISTRICT_INDEX = [(_norm_key(r["district"]), r) for r in rows]
    return _DISTRICT_INDEX


def _lookup_district(name: str) -> dict | None:
    """Return {district,state,latitude,longitude} for a REAL Indian district,
    else None.

    Callers speak in their own language, so STT returns the district in native
    script (Devanagari / Bengali / Tamil) while the reference table stores Latin
    names. We therefore match in three stages:
      1. exact case-insensitive match on the Latin name (fast path, unchanged);
      2. exact match on a transliterated, punctuation-stripped key
         ('पटना' -> 'patanaa');
      3. fuzzy match of that key against the whole table, to absorb schwa
         deletion and STT spelling drift ('patanaa' ~ 'patna').
    Only names that resolve to a real district are accepted; unrelated words
    (e.g. 'दसवीं' = 10th class) fall below the threshold and are rejected."""
    rows = q("select district, state, latitude, longitude from indian_districts "
             "where lower(district)=lower(%s) limit 1", (name.strip(),))
    if rows:
        return rows[0]

    key = _norm_key(name)
    if len(key) < 3:
        return None

    # Curated aliases for non-phonetic English spellings (Lucknow, Varanasi…).
    canonical = _DISTRICT_ALIASES.get(key)
    if canonical:
        rows = q("select district, state, latitude, longitude from indian_districts "
                 "where lower(district)=lower(%s) limit 1", (canonical,))
        if rows:
            return rows[0]

    # Fuzzy matching is risky for very short keys against ~770 names (a 3-letter
    # filler word would collide), so only keys of 4+ chars are fuzzy-matched;
    # shorter names must match exactly (handled above / by the equality check).
    allow_fuzzy = len(key) >= 4
    best, best_score = None, 0.0
    for nk, row in _district_index():
        if not nk:
            continue
        if key == nk:
            return row
        if allow_fuzzy:
            score = difflib.SequenceMatcher(None, key, nk).ratio()
            if score > best_score:
                best_score, best = score, row
    return best if best_score >= 0.74 else None


def _validate_patch(patch: dict) -> dict[str, str]:
    """Drop invalid fields from `patch` IN PLACE and return {field: re-ask
    message} for each rejection.

    home_district: must be a REAL Indian district (checked against
    indian_districts). A real district we don't have centres in is ACCEPTED —
    we then route to the nearest centre. Only names that aren't Indian
    districts at all are rejected. When accepted, we also stamp the
    beneficiary's home_state + lat/long so the ranker can compute real distance
    to the nearest training centre anywhere.
    age: plausible working age 10-80.
    """
    rejected: dict[str, str] = {}

    d = patch.get("home_district")
    if d:
        hit = _lookup_district(d)
        if hit:
            patch["home_district"] = hit["district"]      # canonical spelling
            patch.setdefault("home_state", hit["state"])
            patch.setdefault("latitude", hit["latitude"])
            patch.setdefault("longitude", hit["longitude"])
        else:
            patch.pop("home_district", None)
            rejected["home_district"] = (
                f"Sorry, I couldn't find any district named '{d}' in India. "
                f"Please say your district again — for example Patna, Bhagalpur or Jhabua.")

    a = patch.get("age")
    if a is not None and not (10 <= int(a) <= 80):
        patch.pop("age", None)
        rejected["age"] = "That doesn't look like a valid age. Please tell me your age in years, for example 24."

    return rejected


def _rephrase(question: str) -> str:
    return "क्षमा करें, फिर से कहेंगे? " + question


_REASK_HINTS = {
    "name":            {"en": "Sorry, I didn't catch your name. Please tell me your name.",
                        "hi": "क्षमा करें, नाम समझ नहीं आया। कृपया अपना नाम बताएं।"},
    "home_district":   {"en": "Sorry, which district or city do you live in?",
                        "hi": "क्षमा करें, आप किस ज़िले या शहर में रहते हैं?"},
    "age":             {"en": "I need your age in years — for example, 22.",
                        "hi": "कृपया अपनी उम्र सालों में बताएँ — जैसे 22।"},
    "education_class": {"en": "Please tell me the class you passed — 10th, 12th, or higher.",
                        "hi": "कृपया बताएं आपने कौन सी कक्षा पास की — दसवीं, बारहवीं, या उससे ऊपर?"},
    "interests":       {"en": "Any specific work you enjoy? For example: tailoring, mobile repair, dairy, mason.",
                        "hi": "कोई विशेष काम जो आपको पसंद हो? जैसे — सिलाई, मोबाइल रिपेयर, डेयरी, मिस्त्री।"},
    "mobility_km":     {"en": "About how many kilometres can you travel — 5, 20, or into the city?",
                        "hi": "आप कितने किलोमीटर तक जा सकती हैं — 5, 20, या शहर तक?"},
    "has_smartphone":  {"en": "Do you have a smartphone (like Android) or a basic phone?",
                        "hi": "क्या आपके पास स्मार्टफोन है या साधारण फोन?"},
    "self_employ_ok":  {"en": "Would you prefer your own work / shop, or a salaried job?",
                        "hi": "आप अपना काम / दुकान चाहेंगे, या नौकरी?"},
    "aspiration":      {"en": "Got it. And would you rather work close to home, or in the city?",
                        "hi": "ठीक है। और आप काम घर के पास करना चाहेंगी, या शहर में?"},
    "social_category": {"en": "Please say one: SC, ST, OBC, or General.",
                        "hi": "कृपया एक बताएँ: SC, ST, OBC, या सामान्य।"},
}


def _reask(original_question: str, field: str, language: str) -> str:
    """Return the ENGLISH re-ask hint. The router localises it via i18n, and
    the human hi/bn/ta/mr wordings are pre-seeded into the translation cache
    (see reask_seed) so they never touch the network."""
    return (_REASK_HINTS.get(field, {}).get("en")
            or f"Sorry, could you answer again? {original_question}")


def reask_seed() -> dict[str, dict[str, str]]:
    """Human translations of the re-ask hints + filler, shaped for i18n.seed:
    {english_text: {lang: translated}}."""
    out: dict[str, dict[str, str]] = {}
    for _field, langs in _REASK_HINTS.items():
        en = langs.get("en")
        if not en:
            continue
        out[en] = {lang: txt for lang, txt in langs.items() if lang != "en"}
    return out
