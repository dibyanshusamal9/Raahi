"""FR-03 · Typed profile extraction from speech.

Takes a natural-language answer + the last question and returns a
BeneficiaryPatch. A patch that fails validation returns None — the caller
then asks a rephrased question rather than silently writing bad data.

Providers: mock (deterministic rules), anthropic, openai, sarvam.
Swap via EXTRACTOR_PROVIDER env var."""
from __future__ import annotations
import json, re
from typing import Any
import httpx
from ..settings import settings
from ..logging import log
from ..models.beneficiary import BeneficiaryPatch


PROMPT_TEMPLATE = """You are a strict extractor. Read the speaker's short answer and
output ONLY facts that are EXPLICITLY present in that answer.

Emit ONE JSON object using ONLY these fields (OMIT any field the answer does not clearly state):

  {schema}

STRICT RULES — READ EVERY WORD:
1. NEVER GUESS. NEVER INFER. If the answer does not literally contain the fact, OMIT the field.
2. Do not use the "Last question asked" to invent a value. It is context only, not an answer.
3. Do not derive one field from another. Examples of things you MUST NOT do:
   - Mentioning a place name does NOT set mobility_km. Do NOT set mobility_km unless the
     speaker literally says how far they will travel ("5 km", "near home", "in the city").
   - Mentioning "smartphone" alone does NOT tell you their interests. Do NOT set interests.
   - Saying "own work" or "khud ka kaam" sets self_employ_ok=true and NOTHING ELSE.
   - Saying just "yes" / "haan" / "no" sets NOTHING (return {{}}).
   - Saying just a place name ("Delhi", "Nalanda", "Bhagalpur") sets ONLY home_district.
4. If unsure whether a field is stated, OMIT it. Missing is always safer than wrong.
5. Return {{}} if the answer is a greeting, confirmation, or contains no facts.

FIELD DEFINITIONS (only apply when the answer literally contains this info):
- home_district: district/place they LIVE in. Only from words like "I live in X", "I am from X", "mera ghar X mein", or a bare place name.
- age: integer years, ONLY when the answer says a number followed by year/saal/varsh/yrs.
- education_class: highest class passed as int. "12th pass"/"class 12"/"बारहवीं" → 12. "graduate" → 15.
- aspiration: short phrase, ONLY when the speaker describes what kind of work they want ("near home", "city job", "government job").
- interests: array of sector/skill keywords the speaker EXPLICITLY names ("tailoring", "weaving", "mobile repair", "beauty", "dairy", "mason", "retail", "electrical"). Do NOT infer.
- mobility_km: integer km, ONLY when the answer states a distance or clear distance phrase ("5 km", "20 km", "ghar ke paas"→5, "near home"→5, "10-20 km"→20, "shahar tak"/"in the city"→50). A district name alone does NOT set this.
- has_smartphone: true only if smartphone/android/स्मार्टफोन is said; false only if basic/keypad/फीचर फोन is said.
- self_employ_ok: true only if speaker mentions their own work/business/shop/apna kaam/khud ka kaam.
- social_category: one of SC | ST | OBC | GEN, only if stated. Do NOT extract from words like "namaste" that merely contain those letters.
- language: always set to "{language}".

Last question asked (context ONLY — do not treat as an answer): {question}
Speaker's answer: {answer}

Return ONLY the JSON object. No prose, no markdown, no explanation:"""


# Circuit breaker: once an LLM provider fails with an auth/permission/quota
# error (e.g. Grok 403 "no credit"), stop calling it for the life of the
# process. Otherwise every single turn pays an ~800 ms network round-trip to a
# provider that can never succeed, then falls back to the rules anyway. Cleared
# only by a restart — which is when new credentials would take effect.
_PROVIDER_DISABLED: set[str] = set()
# 400 too: an LLM endpoint returns it for an unknown model / malformed request
# (e.g. Grok returns 400 "model not found" for a model the key can't access),
# and that never fixes itself within a running process.
_FATAL_STATUSES = {400, 401, 402, 403, 404, 429}


async def extract(question: str, answer: str, language: str) -> BeneficiaryPatch | None:
    provider = settings.extractor_provider
    llm_raw: dict = {}
    if provider not in _PROVIDER_DISABLED:
        try:
            if provider == "anthropic" and settings.anthropic_api_key:
                llm_raw = await _anthropic(question, answer, language)
            elif provider == "openai" and settings.openai_api_key:
                llm_raw = await _openai(question, answer, language)
            elif provider == "groq" and settings.groq_api_key:
                llm_raw = await _groq(question, answer, language)
            elif provider == "gemini" and settings.gemini_api_key:
                llm_raw = await _gemini(question, answer, language)
            elif provider in ("grok", "xai") and (settings.grok_api_key or settings.xai_api_key):
                llm_raw = await _grok(question, answer, language)
            elif provider == "sarvam" and settings.sarvam_api_key:
                llm_raw = await _sarvam(question, answer, language)
        except httpx.HTTPStatusError as e:
            if e.response.status_code in _FATAL_STATUSES:
                _PROVIDER_DISABLED.add(provider)
                log.warning("extractor.provider_disabled_for_session",
                            provider=provider, status=e.response.status_code,
                            note="rule-based extractor will handle every turn from now on")
            else:
                log.warning("extractor.llm_failed_using_mock_only", err=str(e))
        except Exception as e:
            log.warning("extractor.llm_failed_using_mock_only", err=str(e))

    # Always run deterministic rules too — they catch what the LLM misses.
    mock_raw = _mock(question, answer, language)

    # Sanitize each independently, then merge (mock wins on primitives).
    merged: dict = {}
    for src in (_sanitize(llm_raw or {}, answer), _sanitize(mock_raw, answer)):
        for k, v in src.items():
            if v in (None, "", []):
                continue
            if k == "interests":
                cur = merged.get("interests") or []
                merged["interests"] = list(dict.fromkeys([*cur, *v]))
            else:
                merged[k] = v  # last write wins → mock overrides LLM for primitives

    # Extract home_district from short place-name answers ONLY when the last
    # question was actually asking for the district (otherwise "weaving" or
    # "close to home" would masquerade as a place name).
    #
    # Extra guard: if any OTHER rule already recognised this answer as a
    # concrete fact — an education word, an age, an interest — then it is not
    # a place name, whatever question happened to be pending. Without this,
    # a caller answering the district question with "दसवीं" (10th class) had
    # "दसवीं" stored as their district, which then poisons demand matching.
    if "home_district" not in merged:
        # Explicit phrases ("from X", "X se hun") are always trusted. A BARE
        # answer is only a place name if no other rule already claimed this
        # utterance as a concrete fact — otherwise a caller answering the
        # district question with "दसवीं" (10th class) ends up with "दसवीं"
        # stored as their district, which then poisons demand matching.
        claimed_by_other_rule = any(
            k in merged for k in
            ("education_class", "education_note", "age", "interests",
             "has_smartphone", "self_employ_ok", "social_category", "mobility_km")
        )
        d = _guess_district(answer, question, allow_bare=not claimed_by_other_rule)
        if d:
            merged["home_district"] = d

    try:
        return BeneficiaryPatch(**merged)
    except Exception:
        return None


_STOPWORDS = {"i", "am", "the", "a", "an", "in", "at", "from", "of", "is",
              "and", "or", "to", "my", "our", "we", "you", "he", "she", "they",
              "yes", "no", "haan", "nahi", "ok", "okay", "hello", "hi",
              "please", "thanks", "namaste", "namaskar", "vanakkam",
              # meta-text a translation model may occasionally echo for a bare
              # proper noun — must never be stored as a name or district
              "telugu", "tamil", "hindi", "bengali", "marathi", "english",
              "translate", "translation", "translated"}


def _looks_like_metatext(s: str) -> bool:
    """True if a translated name/place looks like a translation artefact
    ('Telugu To English', 'Translation:', ...) rather than a real value."""
    low = (s or "").lower()
    return bool(re.search(r"\b(to english|translation|translate|source|target)\b", low))


def _guess_district(answer: str, question: str = "", allow_bare: bool = True) -> str | None:
    """Pull a home district from 'I live in X' / 'I am from X' phrasings, or,
    when the last question was clearly about the district, from a bare short
    answer. Otherwise return None — a random short answer must NOT be treated
    as a place name."""
    a = (answer or "").strip()
    if not a:
        return None

    # Phrase forms — always accepted, wherever they appear
    for pat in (r"\blive[s]?\s+in\s+([A-Za-zऀ-ॿ][\wऀ-ॿ\s]*)",
                r"\bfrom\s+([A-Za-zऀ-ॿ][\wऀ-ॿ\s]*)",
                r"\bbelong\s+to\s+([A-Za-zऀ-ॿ][\wऀ-ॿ\s]*)",
                r"\brehti\s+hun\s+([A-Za-zऀ-ॿ][\wऀ-ॿ\s]*)",
                r"([A-Za-zऀ-ॿ][\wऀ-ॿ\s]*?)\s+mein\s+rehti",
                # "main Nalanda se hun" / "मैं नालंदा से हूं" — X + se/से
                r"\bmain\s+([A-Za-zऀ-ॿ][\wऀ-ॿ\s]*?)\s+se\b",
                r"मैं\s+([\wऀ-ॿ\s]*?)\s+से",
                r"([A-Za-zऀ-ॿ][\wऀ-ॿ\s]*?)\s+से\s+ह",
                r"আমি\s+([\wऀ-ॿ\s]*?)\s+থেকে",
                r"நான்\s+([\wऀ-ॿ\s]*?)\s+இருந்து"):
        m = re.search(pat, a, re.IGNORECASE)
        if m:
            place = _clean_place(m.group(1))
            if place:
                return place

    # Bare short answer only if the question was actually about district AND
    # no other rule already claimed this utterance (see allow_bare).
    if not allow_bare:
        return None
    q = (question or "").lower()
    was_district_q = any(k in q for k in ("district", "ज़िले", "जिले", "जिला",
                                          "জেলা", "மாவட்ட", "जिल्हा"))
    if not was_district_q:
        return None

    words = re.findall(r"[A-Za-zऀ-ॿ]+", a)
    if 1 <= len(words) <= 3 and not re.search(r"\d", a):
        keep = [w for w in words if w.lower() not in _STOPWORDS]
        if keep:
            return _clean_place(" ".join(keep))
    return None


_WORD_TENS = {"twenty":20, "thirty":30, "forty":40, "fifty":50,
              "sixty":60, "seventy":70, "eighty":80}
_WORD_ONES = {"one":1,"two":2,"three":3,"four":4,"five":5,
              "six":6,"seven":7,"eight":8,"nine":9}
_WORD_TEENS = {"ten":10, "eleven":11, "twelve":12, "thirteen":13, "fourteen":14,
               "fifteen":15, "sixteen":16, "seventeen":17, "eighteen":18, "nineteen":19}


def _english_word_number(answer: str) -> int | None:
    """Parse 'twenty two', 'thirty-five', 'nineteen' → integer."""
    a = (answer or "").lower().replace("-", " ").strip()
    if not a:
        return None
    if a in _WORD_TEENS:
        return _WORD_TEENS[a]
    if a in _WORD_TENS:
        return _WORD_TENS[a]
    parts = a.split()
    if len(parts) == 2 and parts[0] in _WORD_TENS and parts[1] in _WORD_ONES:
        return _WORD_TENS[parts[0]] + _WORD_ONES[parts[1]]
    return None


def _extract_name(answer: str, was_name_q: bool = False) -> str | None:
    """Pull a personal name. Phrase forms ('my name is X') work anywhere;
    bare short answers ('Radha') are ONLY accepted when the last question was
    actually asking for the name — otherwise 'mobile repair' would masquerade."""
    a = (answer or "").strip().strip(".!?।")
    if not a:
        return None

    # Phrase forms — always accepted, wherever they appear in the sentence.
    # Capture is non-greedy and stops at a digit or a boundary word, so
    # "im nidhish 19 saal ka from panchkula" yields "nidhish", not the
    # whole tail of the sentence.
    for pat in (r"my name is\s+([A-Za-zऀ-ॿ][\wऀ-ॿ\s]*)",
                r"\bname\s+is\s+([A-Za-zऀ-ॿ][\wऀ-ॿ\s]*)",
                r"\bi\s*['’]?\s*m\s+([A-Za-zऀ-ॿ][\wऀ-ॿ\s]*)",   # i'm / im / i m
                r"\bi\s+am\s+([A-Za-zऀ-ॿ][\wऀ-ॿ\s]*)",
                r"\bmyself\s+([A-Za-zऀ-ॿ][\wऀ-ॿ\s]*)",
                r"\bthis\s+is\s+([A-Za-zऀ-ॿ][\wऀ-ॿ\s]*)",
                r"mera naam\s+([A-Za-zऀ-ॿ][\wऀ-ॿ\s]*)",
                r"मेरा नाम\s+([\wऀ-ॿ\s]*)",
                r"माझं नाव\s+([\wऀ-ॿ\s]*)",
                r"என் பெயர்\s+([\wऀ-ॿ\s]*)",
                r"আমার নাম\s+([\wऀ-ॿ\s]*)"):
        m = re.search(pat, a, re.IGNORECASE)
        if m:
            n = _clean_name(m.group(1))
            if n:
                return n

    if not was_name_q:
        return None

    # Bare short answer of 1–3 words with no digits → treat as a name
    words = re.findall(r"[A-Za-zऀ-ॿ]+", a)
    if 1 <= len(words) <= 3 and not re.search(r"\d", a):
        keep = [w for w in words if w.lower() not in _STOPWORDS]
        if keep:
            return _clean_name(" ".join(keep))
    return None


# Words that end a name inside a longer sentence. "im nidhish 19 saal ka from
# panchkula" must yield "Nidhish", not the whole remainder.
_NAME_STOP_WORDS = {
    "from", "of", "and", "age", "aged", "years", "year", "yrs", "old",
    "saal", "varsh", "ka", "ki", "ke", "se", "hu", "hun", "hai", "he",
    "living", "live", "lives", "studying", "studied", "class", "pass",
    "साल", "वर्ष", "से", "है", "हूं", "हूँ", "का", "की", "के",
    "বছর", "থেকে", "வயது", "இருந்து",
}


def _clean_name(s: str) -> str | None:
    s = re.sub(r"\b(is|hai|hu|hun|call me|me|my)\b", "", s, flags=re.IGNORECASE).strip()
    s = s.strip(" ,.!?।")
    if not s:
        return None

    # Cut the moment we hit a digit or a boundary word — everything after it
    # belongs to another fact (age, district, education), not the name.
    parts: list[str] = []
    for tok in s.split():
        bare = tok.strip(" ,.!?।'\"").lower()
        if not bare or any(ch.isdigit() for ch in bare) or bare in _NAME_STOP_WORDS:
            break
        parts.append(tok.strip(" ,.!?।"))
        if len(parts) == 3:          # a name is at most three words
            break
    if not parts:
        return None

    out = " ".join(p.capitalize() if p.isascii() else p for p in parts)
    if len(out) < 2 or _looks_like_metatext(out):
        return None
    return out


def _clean_place(s: str) -> str | None:
    s = s.strip(" ,.!?।")
    if not s or len(s) < 2 or _looks_like_metatext(s):
        return None
    # cap at 3 words to avoid grabbing a whole sentence
    parts = s.split()[:3]
    return " ".join(p.capitalize() if p.isascii() else p for p in parts)


# ----- Grounding guard: drop any field the LLM can't justify from the text -----
_DISTANCE_HINTS = ("km", "kilomet", "किमी", "किलोमीटर", "kilomit", "কিলোমিটার",
                   "கிலோ", "किलो", "near", "paas", "पास", "close", "nearby",
                   "ghar ke paas", "shahar", "शहर", "city", "in the city",
                   "gaon", "गांव", "गाँव", "home")
_SMARTPHONE_YES = ("smart", "स्मार्ट", "android", "एंड्रॉ", "iphone")
_SMARTPHONE_NO  = ("basic", "keypad", "feature phone", "फीचर", "सामान्य फोन", "साधा फोन")
_SELF_EMPLOY    = ("own work", "own business", "apna kaam", "khud ka", "अपना काम",
                   "स्वयं", "shop", "दुकान", "business", "व्यवसाय", "self")
# SINGLE multilingual keyword → sector table. Used by BOTH the rule-based
# extractor and the grounding sanitizer — keeping them in one place stops the
# two drifting apart (a Marathi answer like "शिवणकाम" was being captured by the
# rules and then thrown away by a sanitizer that had never heard of it).
_INTEREST_WORDS = {
    # apparel / tailoring
    "tailor": "apparel", "silai": "apparel", "sewing": "apparel", "sew": "apparel",
    "embroid": "apparel", "stitch": "apparel",
    "सिलाई": "apparel", "शिवणकाम": "apparel", "कढ़ाई": "apparel", "दर्जी": "apparel",
    "সেলাই": "apparel", "তৈরি পোশাক": "apparel",
    "தையல்": "apparel",
    # handloom / weaving
    "weav": "handloom", "handloom": "handloom", "loom": "handloom",
    "बुनाई": "handloom", "विणकाम": "handloom", "बुनकर": "handloom",
    "বুনন": "handloom", "তাঁত": "handloom",
    "நெசவு": "handloom",
    # textiles (mill trades) — often the English word in the caller's script
    "textile": "textile", "spinning": "textile", "knitting": "textile", "dyeing": "textile",
    "टेक्सटाइल": "textile", "टेक्स्टाइल": "textile", "टैक्सटाइल": "textile", "कताई": "textile",
    "टेक्सटाईल": "textile", "वस्त्रोद्योग": "textile",
    "টেক্সটাইল": "textile",
    "டெக்ஸ்டைல்": "textile", "ஜவுளி": "textile",
    # telecom / mobile repair
    "mobile repair": "telecom", "phone repair": "telecom", "mobile": "telecom",
    "मोबाइल रिपेयर": "telecom", "मोबाईल दुरुस्ती": "telecom", "मोबाइल": "telecom",
    "মোবাইল সারানো": "telecom", "মোবাইল": "telecom",
    "மொபைல் ரிப்பேர்": "telecom", "மொபைல்": "telecom",
    # electronics / electrical
    "electric": "electronics", "solar": "electronics", "wiring": "electronics",
    "बिजली": "electronics", "वीजकाम": "electronics", "इलेक्ट्रिक": "electronics",
    "বৈদ্যুতিক": "electronics", "মিন்சார": "electronics", "மின்சார": "electronics",
    # beauty & wellness
    "beauty": "beauty & wellness", "makeup": "beauty & wellness",
    "mehendi": "beauty & wellness", "hair": "beauty & wellness", "salon": "beauty & wellness",
    "ब्यूटी": "beauty & wellness", "मेहंदी": "beauty & wellness", "पार्लर": "beauty & wellness",
    "সাজসজ্জা": "beauty & wellness", "রূপচর্চা": "beauty & wellness",
    "அழகு": "beauty & wellness",
    # agriculture / dairy
    "dairy": "agriculture", "poultry": "agriculture", "kheti": "agriculture",
    "farming": "agriculture", "farmer": "agriculture", "crop": "agriculture",
    "दूध": "agriculture", "खेती": "agriculture", "डेयरी": "agriculture", "शेती": "agriculture",
    "দুধ": "agriculture", "কৃষি": "agriculture",
    "பால்": "agriculture", "விவசாய": "agriculture",
    # retail
    "retail": "retail", "shop": "retail", "shopkeep": "retail", "store": "retail",
    "दुकान": "retail", "दुकानदारी": "retail",
    "দোকান": "retail", "கடை": "retail",
    # construction
    "mason": "construction", "mistri": "construction", "welder": "construction",
    "plumber": "construction", "carpenter": "construction",
    "राजमिस्त्री": "construction", "मिस्त्री": "construction", "गवंडी": "construction",
    "সুতার": "construction", "রাজমিস্ত্রি": "construction",
    "கொத்தனார்": "construction",
}
def skill_words_in(text: str, vocabulary: list[str]) -> list[str]:
    """The skill words from `vocabulary` that `text` contains as whole words
    (a plural counts), longest first: "mobile repair" wins over "mobile", and
    "it" never matches inside "with"."""
    t = (text or "").lower()
    found: list[str] = []
    for word in sorted({w.lower().strip() for w in vocabulary}, key=len, reverse=True):
        if word and re.search(rf"\b{re.escape(word)}(?:s|es)?\b", t) \
                and not any(word in f for f in found):
            found.append(word)
    return found


_CATEGORY_WORDS = {"sc": "SC", "st": "ST", "obc": "OBC", "gen": "GEN",
                   "general": "GEN", "अनुसूचित जाति": "SC", "अनुसूचित जनजाति": "ST"}


def _sanitize(patch: dict, answer: str) -> dict:
    """Drop any field the LLM invented — keep only those grounded in the answer."""
    if not patch:
        return {}
    a = (answer or "").lower()

    out = dict(patch)

    # mobility_km: only if the text contains a distance signal
    if "mobility_km" in out and not (
        any(h in a for h in _DISTANCE_HINTS)
        or _any(a, _NEAR_WORDS) or _any(a, _CITY_WORDS)
    ):
        out.pop("mobility_km", None)

    # age: only if a small integer is literally in the answer (digit OR word form)
    if "age" in out:
        m = re.search(r"\b(\d{1,2})\b", a)
        digit_valid = m and 10 <= int(m.group(1)) <= 80
        word_valid = (_english_word_number(a) is not None) or (_native_number(a) is not None)
        if not (digit_valid or word_valid):
            out.pop("age", None)

    # education_class: re-derive from the raw answer via the single parser, so
    # an LLM can't inject "class 19" and a bare age-like number is never a class.
    if "education_class" in out:
        cls, _note = _parse_education(a)
        v = out.get("education_class")
        if cls is not None:
            out["education_class"] = cls
        elif isinstance(v, int) and 1 <= v <= 13:
            pass  # LLM value already in valid range and answer had some signal
        else:
            out.pop("education_class", None)

    # has_smartphone: only if the text talks about a phone
    if "has_smartphone" in out:
        if out["has_smartphone"] and not (_any(a, _SMARTPHONE_YES) or _any(a, _SMART_YES)):
            out.pop("has_smartphone", None)
        elif out["has_smartphone"] is False and not (_any(a, _SMARTPHONE_NO) or _any(a, _SMART_NO)):
            out.pop("has_smartphone", None)

    # self_employ_ok: needs a self-employment OR salaried-job keyword
    if "self_employ_ok" in out:
        if out["self_employ_ok"] and not (_any(a, _SELF_EMPLOY) or _any(a, _SELF_YES)):
            out.pop("self_employ_ok", None)
        elif out["self_employ_ok"] is False and not _any(a, _SELF_NO):
            out.pop("self_employ_ok", None)

    # interests: keep known items whose keyword appears in the answer,
    # PLUS any free-text interest the speaker literally said (short 1–3
    # word phrase). This means "cricket coaching" or "food delivery" —
    # things not in the whitelist — still become a real interest instead
    # of being dropped.
    if "interests" in out and isinstance(out["interests"], list):
        kept: list[str] = []
        for item in out["interests"]:
            item_l = str(item).lower().strip()
            if not item_l:
                continue
            mapped = None
            for kw, canonical in _INTEREST_WORDS.items():
                if kw in a and (canonical in item_l or kw in item_l):
                    mapped = canonical
                    break
            # Keep the caller's own words whenever they literally said them
            # ("mobile repair"), next to the sector word ("telecom"): the
            # ranker needs the specific trade, the sector alone is too broad.
            if item_l in a and 2 <= len(item_l) <= 40:
                kept.append(item_l)
            if mapped:
                kept.append(mapped)
        out["interests"] = list(dict.fromkeys(kept))
        if not out["interests"]:
            out.pop("interests", None)

    # social_category: must be one of the codes AND literally mentioned as a word
    if "social_category" in out:
        cat = str(out["social_category"]).upper()
        if cat not in {"SC", "ST", "OBC", "GEN"}:
            out.pop("social_category", None)
        else:
            # ensure the text actually mentions it as a word (not just letters inside "namaste")
            hit = re.search(r"\b(sc|st|obc|gen|general)\b", a) or \
                  any(phrase in answer for phrase in _CATEGORY_NATIVE)
            if not hit:
                out.pop("social_category", None)

    # aspiration: keep only if the answer talks about wanting/preferring work
    # OR mentions a location preference ("close to home" / "in the city" / etc.)
    if "aspiration" in out:
        keyword_hit = re.search(
            r"want|would like|prefer|चाहती|चाहत|चाहूँ|kaam|काम|job|work|"
            r"near|nearby|paas|shahar|city|close|home|ghar|घर|शहर|यहीं|"
            r"salary|salaried|naukri|नौकरी|চাকরি|কাজ|வேலை", a)
        if not (keyword_hit or _any(a, _NEAR_WORDS) or _any(a, _CITY_WORDS)
                or _any(a, _SELF_YES) or _any(a, _SELF_NO)):
            out.pop("aspiration", None)

    # home_district: keep as-is (a place name is hard to hallucinate from typed input)
    return out


# ---------------------------------------------------------------------------
# Multilingual keyword tables.
#
# The rule-based extractor is the ONLY extractor that always works (LLM
# providers can be rate-limited, out of credit, or slow), and this product
# is voice-first in Indian languages. So every rule below must recognise
# Devanagari (hi/mr), Bengali (bn) and Tamil (ta) as well as romanised
# transliteration — not just English.
# ---------------------------------------------------------------------------

# "near home" / short travel radius
_NEAR_WORDS = (
    # en / romanised — include the shapes Sarvam produces when translating
    # "ghar ke paas" / "ఇంటికి దగ్గరగా" etc. ("near the house", "near house")
    "near home", "near the home", "near house", "near the house", "near my",
    "close to home", "close to house", "close to the", "nearby", "close by",
    "near by", "walking distance", "in the village", "village",
    "ghar ke paas", "paas hi", "gaon", "gaon me", "nazdeek",
    # hi / mr (Devanagari)
    "घर के पास", "घर के नज़दीक", "घर के नजदीक", "पास में", "पास ही", "यहीं",
    "गाँव", "गांव", "जवळच", "घराजवळ", "जवळ", "नजीक",
    # bn
    "বাড়ির কাছে", "পাশেই", "কাছেই", "কাছে", "গ্রামে",
    # ta
    "வீட்டுக்கு அருகில்", "அருகில்", "பக்கத்தில்", "கிராமத்தில்",
)
# "in the city" / long travel radius
_CITY_WORDS = (
    "in the city", "in city", "city", "shahar", "shehar",
    "शहर", "शहरात", "शहर में",
    "শহরে", "শহর",
    "நகரத்தில்", "நகரம்",
)
# smartphone yes / no
_SMART_YES = (
    "smart", "smartphone", "android", "iphone", "touch phone",
    "स्मार्टफोन", "स्मार्ट फोन", "एंड्रॉइड", "एंड्राइड", "स्मार्टफोन आहे",
    "স্মার্টফোন", "অ্যান্ড্রয়েড",
    "ஸ்மார்ட்போன்", "ஆண்ட்ராய்டு",
)
_SMART_NO = (
    "basic phone", "keypad", "feature phone", "simple phone", "button phone",
    "फीचर फोन", "साधारण फोन", "साधा फोन", "कीपैड", "बटन वाला",
    "সাধারণ ফোন", "কীপ্যাড", "বেসিক ফোন",
    "சாதாரண போன்", "பட்டன் போன்",
)
# wants own work (self-employment)
_SELF_YES = (
    "own work", "own business", "own shop", "self employ", "self-employ",
    "apna kaam", "khud ka", "khud ka kaam", "apni dukan", "business",
    "अपना काम", "अपना व्यवसाय", "अपनी दुकान", "खुद का", "स्वयं का", "स्वतःचा",
    "स्वतःचं काम", "व्यवसाय",
    "নিজের কাজ", "নিজের ব্যবসা", "স্বনিযুক্তি", "নিজের দোকান",
    "சொந்த வேலை", "சொந்த தொழில்", "சொந்தமாக",
)
# prefers a salaried job
_SELF_NO = (
    "salaried", "salary job", "salaried job", "a job", "job", "naukri", "nokri",
    # hi / mr — note both नौकरी (hi) and नोकरी (mr) spellings
    "नौकरी", "नोकरी", "पगारी", "पगाराची नोकरी", "वेतन",
    "চাকরি", "বেতনের চাকরি",
    # ta — "சம்பள வேலை" (salaried work) only; bare "வேலை" just means "work"
    # and collides with "சொந்த வேலை" (own work), so it must NOT appear here.
    "சம்பள வேலை", "ஊதிய வேலை",
)
# social category (native-script forms)
_CATEGORY_NATIVE = {
    # hi: जाति (ति) and mr: जाती (ती) both occur — include both spellings
    "अनुसूचित जाति": "SC", "अनुसूचित जाती": "SC",
    "अनुसूचित जनजाति": "ST", "अनुसूचित जनजाती": "ST", "अनुसूचित जमात": "ST",
    "पिछड़ा": "OBC", "इतर मागास": "OBC", "ओबीसी": "OBC",
    "सामान्य": "GEN", "सर्वसाधारण": "GEN", "खुला": "GEN",
    "তফসিলি জাতি": "SC", "তফসিলি উপজাতি": "ST", "সাধারণ": "GEN", "ওবিসি": "OBC",
    "பட்டியல் சாதி": "SC", "பட்டியல் பழங்குடி": "ST", "பொது": "GEN", "ஓபிசி": "OBC",
}
# age unit words (so "বাইশ বছর" / "இருபது வயது" are seen as an age answer)
_AGE_UNITS = ("साल", "साला", "वर्ष", "वय", "बरस",
              "বছর", "বয়স",
              "வயது", "வருடம்",
              "saal", "varsh", "years", "year", "yrs", "yr", "old")
# education / class words
_CLASS_UNITS = ("वीं", "कक्षा", "पास", "इयत्ता",
                "শ্রেণী", "শ্রেণি", "ক্লাস", "পাস",
                "வகுப்பு", "படித்த",
                "class", "th", "standard", "std", "pass")

# Devanagari / Bengali / Tamil number words → int (10-80 covers ages)
_NATIVE_NUMBERS = {
    # hi / mr
    "दस": 10, "ग्यारह": 11, "बारह": 12, "तेरह": 13, "चौदह": 14, "पंद्रह": 15,
    "सोलह": 16, "सत्रह": 17, "अठारह": 18, "उन्नीस": 19, "बीस": 20,
    "इक्कीस": 21, "बाईस": 22, "तेईस": 23, "चौबीस": 24, "पच्चीस": 25,
    "छब्बीस": 26, "सत्ताईस": 27, "अट्ठाईस": 28, "उनतीस": 29, "तीस": 30,
    "पैंतीस": 35, "चालीस": 40, "पैंतालीस": 45, "पचास": 50, "साठ": 60,
    "आठ": 8, "नौ": 9,
    # bn
    "দশ": 10, "এগারো": 11, "বারো": 12, "তেরো": 13, "চৌদ্দ": 14, "পনেরো": 15,
    "ষোল": 16, "সতেরো": 17, "আঠারো": 18, "উনিশ": 19, "বিশ": 20,
    "একুশ": 21, "বাইশ": 22, "তেইশ": 23, "চব্বিশ": 24, "পঁচিশ": 25,
    "ত্রিশ": 30, "চল্লিশ": 40, "পঞ্চাশ": 50,
    # ta
    "பத்து": 10, "பதினைந்து": 15, "இருபது": 20, "இருபத்தி இரண்டு": 22,
    "இருபத்தைந்து": 25, "முப்பது": 30, "நாற்பது": 40, "ஐம்பது": 50,
}


def _native_number(text: str) -> int | None:
    """Find a Devanagari/Bengali/Tamil number word in the answer."""
    t = (text or "").lower()
    # longest match first so "बाईस" wins over "बीस" inside it
    for word in sorted(_NATIVE_NUMBERS, key=len, reverse=True):
        if word in t:
            return _NATIVE_NUMBERS[word]
    return None


# ----- education parsing -----
# School class words → 1-12. "graduate/college/diploma/degree/b.tech/..." are
# all "beyond school" → 13 with a friendly label. NEVER produce class > 12 from
# a bare number.
_POST12_WORDS = (
    "graduate", "graduation", "under graduate", "undergraduate", "postgraduate",
    "post graduate", "bachelor", "bachelors", "master", "masters", "degree",
    "b.tech", "btech", "b tech", "b.e", "be ", "b.sc", "bsc", "b.a", "b.com",
    "bcom", "bca", "mca", "mba", "m.tech", "mtech", "phd", "doctorate",
    "college", "university", "स्नातक", "पदवी", "डिग्री", "कॉलेज",
)
_DIPLOMA_WORDS = ("diploma", "polytechnic", "iti", "डिप्लोमा", "पॉलिटेक्निक")
_CLASS_WORD_MAP = {
    "fifth": 5, "sixth": 6, "seventh": 7, "eighth": 8, "ninth": 9, "tenth": 10,
    "matric": 10, "matriculation": 10, "eleventh": 11, "twelfth": 12,
    "inter": 12, "intermediate": 12, "higher secondary": 12, "hsc": 12, "ssc": 10,
    "पाँचवीं": 5, "पांचवीं": 5, "आठवीं": 8, "नौवीं": 9, "दसवीं": 10, "दहावी": 10,
    "ग्यारहवीं": 11, "बारहवीं": 12, "बारावी": 12,
    "দশম": 10, "একাদশ": 11, "দ্বাদশ": 12,
    "பத்தாம்": 10, "பன்னிரண்டாம்": 12,
}


def _parse_education(a: str, question: str = "") -> tuple[int | None, str | None]:
    """Return (education_class, education_note).
    education_class ∈ 1..12 for school, or 13 for anything post-12. None if the
    answer carries no valid schooling signal."""
    a = (a or "").lower()

    # 1) explicit "class 10" / "10th" / "12 pass" / "10 वीं"
    m = re.search(r"class\s*(\d{1,2})|(\d{1,2})\s*(?:th|वीं|वी|कक्षा|pass|पास|"
                  r"standard|std|শ্রেণ|வகுப்பு)", a)
    if m:
        n = int(next(g for g in m.groups() if g))
        if 1 <= n <= 12:
            return n, f"Class {n}"
        # a number with a class-suffix but out of range (e.g. "15th") — invalid
        return None, None

    # 2) post-12 words (graduate / college / b.tech / diploma / "2nd year")
    if any(w in a for w in _POST12_WORDS) or re.search(
            r"\b(first|second|third|fourth|final|1st|2nd|3rd|4th)\s+year\b", a):
        return 13, "Graduate / College"
    if any(w in a for w in _DIPLOMA_WORDS):
        return 13, "Diploma / ITI"

    # 3) native class words ("दसवीं", "দশম", "பத்தாம்")
    for w, cls in sorted(_CLASS_WORD_MAP.items(), key=lambda kv: -len(kv[0])):
        if w in a:
            return cls, f"Class {cls}"

    # 4) bare number ONLY when the question was about class/education, and only
    # if it's a valid school class 1-12. "19" is rejected here.
    q = (question or "").lower()
    if any(k in q for k in ("class", "studied", "study", "education", "school",
                            "कक्षा", "पढ़ाई", "पढ़", "शाळा", "शिक", "শ্রেণ",
                            "পড়া", "வகுப்பு", "படித்த")):
        m2 = re.fullmatch(r"\s*(\d{1,2})\s*", a)
        if m2:
            n = int(m2.group(1))
            if 1 <= n <= 12:
                return n, f"Class {n}"
        nat = _native_number(a)
        if nat is not None and 1 <= nat <= 12:
            return nat, f"Class {nat}"
    return None, None


def _any(text: str, words) -> bool:
    return any(w in text for w in words)


def _word_hit(text: str, word: str) -> bool:
    """Whole-word match that is safe for Indic scripts.

    Python's ``\\b`` is defined between ``\\w`` and ``\\W``. Indic combining
    marks (virama ``्``, matras ``ा``, chandrabindu ``ঁ``) are Unicode
    categories Mn/Mc, which ``\\w`` does NOT include — so a pattern like
    ``\\bह्याँ\\b`` can never match a word that *ends* in one of those marks.
    For non-ASCII words we therefore fall back to plain containment, which
    is what we want for scripts that don't use spaces the same way anyway.
    """
    if not word:
        return False
    if word.isascii():
        return re.search(rf"\b{re.escape(word)}\b", text) is not None
    return word in text


def _any_word(text: str, words) -> bool:
    return any(_word_hit(text, w) for w in words)


# ----- Mock extractor: deterministic heuristics good enough for demo -----
def _mock(question: str, answer: str, language: str) -> dict[str, Any]:
    a = answer.lower()
    p: dict[str, Any] = {"language": language}
    # name — phrase forms ("i'm Nidhish", "mera naam ...") are recognised on
    # ANY turn so a name volunteered in the opening sentence is not lost; a
    # bare answer ("Nidhish") is only treated as a name when we actually asked
    # for one, otherwise "mobile repair" would become someone's name.
    q = (question or "").lower()
    was_name_q = any(k in q for k in
                     ("name?", "your name", "नाम क्या", "பெயர் என்ன", "নাম কী", "नाव काय"))
    name = _extract_name(answer, was_name_q=was_name_q)
    if name:
        p["name"] = name
    # age — "22 saal" / "22 years" / "बाईस साल" / "বাইশ বছর" / bare number in age context
    m = re.search(r"(\d{1,2})\s*(?:" + "|".join(map(re.escape, _AGE_UNITS)) + r")", a)
    if m and 10 <= int(m.group(1)) <= 80:
        p["age"] = int(m.group(1))
    if "age" not in p and _any(a, _AGE_UNITS):
        # native-script number word next to an age unit ("बाईस साल")
        n = _native_number(a)
        if n is not None and 10 <= n <= 80:
            p["age"] = n
    if "age" not in p:
        # Bare number / word-number in an "age" context — the question tells us the topic.
        q_low = (question or "").lower()
        if any(k in q_low for k in ("age", "how old", "उम्र", "वय", "বয়স", "வயது")):
            m2 = re.fullmatch(r"\s*(\d{1,2})\s*", a)
            if m2 and 10 <= int(m2.group(1)) <= 80:
                p["age"] = int(m2.group(1))
            if "age" not in p:
                word_age = _english_word_number(a)
                if word_age is None:
                    word_age = _native_number(a)
                if word_age is not None and 10 <= word_age <= 80:
                    p["age"] = word_age
    # ---- education (highest schooling) ----
    # Model: education_class is a SCHOOL class 1-12. Anything beyond school
    # (graduate / diploma / college / degree) is stored as 13 ("post-12") so it
    # still satisfies course eligibility, with a human label in education_note.
    # A bare number is only a class if it's 1-12 — "19" is NOT a class.
    ecls, enote = _parse_education(a, question)
    if ecls is not None:
        p["education_class"] = ecls
    if enote:
        p["education_note"] = enote
    # smartphone (multilingual)
    if _any(a, _SMART_NO):
        p["has_smartphone"] = False
    elif _any(a, _SMART_YES):
        p["has_smartphone"] = True
    # mobility — explicit distance first
    m = re.search(r"(\d{1,3})\s*(?:km|kms|kilomet\w*|किमी|किलोमीटर|কিলোমিটার|கிலோ\w*)", a)
    if m:
        p["mobility_km"] = int(m.group(1))
    # mobility keywords only — a bare place/district name should NOT set travel range.
    if _any(a, _NEAR_WORDS):
        p.setdefault("mobility_km", 5)
        p.setdefault("aspiration", "close to home")
    if _any(a, _CITY_WORDS):
        p.setdefault("mobility_km", 50)
        p.setdefault("aspiration", "in the city")
    # aspirations & interests
    # Free-text fallback — if the question was clearly the interests one and
    # the answer is a short phrase we don't otherwise recognise, capture it
    # verbatim so the beneficiary's actual interest ("cricket coach",
    # "food delivery", "carpenter") isn't dropped on the floor.
    # NOTE: must NOT match the *aspiration* question, which in English reads
    # "What kind of work would you like — close to home, or in the city?".
    # Match on phrasing unique to the interests question instead.
    q_int = (question or "").lower()
    is_interests_q = any(k in q_int for k in (
        "interests you", "work interests",     # en
        "रुचि है", "रस आहे", "कामांत",          # hi / mr
        "আগ্রহ",                                # bn
        "ஆர்வம்",                               # ta
    ))
    if is_interests_q:
        cleaned = re.sub(r"[.,!?।]", " ", answer).strip()
        words = cleaned.split()
        if 1 <= len(words) <= 5 and cleaned:
            p.setdefault("interests", []).append(cleaned[:60])

    # Sector interests — uses the SHARED _INTEREST_WORDS table so the
    # sanitizer recognises exactly what we capture here. Also keep the trade
    # word the caller actually used ("mobile repair", "weaving" for the key
    # "weav"), not just its sector.
    for kw, sector in _INTEREST_WORDS.items():
        if kw in a:
            said = kw
            if kw.isascii():
                m = re.search(r"[a-z]*" + re.escape(kw) + r"[a-z]*", a)
                if m:
                    said = m.group(0)
            if len(said) >= 3:
                p.setdefault("interests", []).append(said)
            p.setdefault("interests", []).append(sector)

    # self-employment vs salaried job (multilingual). Check the "own work"
    # side FIRST: its phrases are more specific ("சொந்த வேலை" contains the
    # generic word for work, so a job-first check would misread it).
    if _any(a, _SELF_YES):
        p["self_employ_ok"] = True
    elif _any(a, _SELF_NO):
        p["self_employ_ok"] = False

    # category — English codes as whole words, plus native-script phrases
    m_cat = re.search(r"\b(sc|st|obc|gen|general)\b", a)
    if m_cat:
        p["social_category"] = {"general": "GEN"}.get(m_cat.group(1), m_cat.group(1).upper())
    for phrase, cat in _CATEGORY_NATIVE.items():
        if phrase in answer:          # native scripts: match on the raw answer
            p["social_category"] = cat
            break
    return p


# ----- Real providers -----
def _prompt(question: str, answer: str, language: str) -> str:
    schema = ", ".join(BeneficiaryPatch.model_fields.keys())
    return PROMPT_TEMPLATE.format(schema=schema, question=question,
                                  answer=answer, language=language)


async def _anthropic(question: str, answer: str, language: str) -> dict:
    url = "https://api.anthropic.com/v1/messages"
    headers = {"x-api-key": settings.anthropic_api_key,
               "anthropic-version": "2023-06-01"}
    body = {"model": "claude-3-5-sonnet-20241022", "max_tokens": 400,
            "messages": [{"role": "user", "content": _prompt(question, answer, language)}]}
    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.post(url, headers=headers, json=body)
        r.raise_for_status()
        text = r.json()["content"][0]["text"]
        return json.loads(_first_json(text))


async def _openai(question: str, answer: str, language: str) -> dict:
    url = "https://api.openai.com/v1/chat/completions"
    headers = {"Authorization": f"Bearer {settings.openai_api_key}"}
    body = {"model": "gpt-4o-mini",
            "response_format": {"type": "json_object"},
            "messages": [{"role": "user", "content": _prompt(question, answer, language)}]}
    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.post(url, headers=headers, json=body)
        r.raise_for_status()
        return json.loads(r.json()["choices"][0]["message"]["content"])


async def _sarvam(question: str, answer: str, language: str) -> dict:
    url = "https://api.sarvam.ai/v1/chat/completions"
    headers = {"api-subscription-key": settings.sarvam_api_key}
    body = {"model": settings.sarvam_llm_model,
            "temperature": 0.0,
            "messages": [{"role": "user", "content": _prompt(question, answer, language)}]}
    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.post(url, headers=headers, json=body)
        r.raise_for_status()
        return json.loads(_first_json(r.json()["choices"][0]["message"]["content"]))


async def _groq(question: str, answer: str, language: str) -> dict:
    """Groq — free tier, ~200ms latency, Llama 3.3 70B."""
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {settings.groq_api_key}"}
    body = {"model": settings.groq_model,
            "response_format": {"type": "json_object"},
            "messages": [{"role": "user", "content": _prompt(question, answer, language)}],
            "temperature": 0.1}
    async with httpx.AsyncClient(timeout=15.0) as c:
        r = await c.post(url, headers=headers, json=body)
        r.raise_for_status()
        return json.loads(_first_json(r.json()["choices"][0]["message"]["content"]))


async def _gemini(question: str, answer: str, language: str) -> dict:
    """Google Gemini — generous free tier (Gemini 2.0 Flash)."""
    model = settings.gemini_model
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={settings.gemini_api_key}"
    body = {"contents": [{"parts": [{"text": _prompt(question, answer, language)}]}],
            "generationConfig": {"response_mime_type": "application/json", "temperature": 0.1}}
    async with httpx.AsyncClient(timeout=15.0) as c:
        r = await c.post(url, json=body)
        r.raise_for_status()
        text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(_first_json(text))


async def _grok(question: str, answer: str, language: str) -> dict:
    url = "https://api.x.ai/v1/chat/completions"
    api_key = settings.grok_api_key or settings.xai_api_key
    headers = {"Authorization": f"Bearer {api_key}"}
    body = {
        "model": settings.grok_model,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "user", "content": _prompt(question, answer, language)}],
        "temperature": 0.1,
    }
    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.post(url, headers=headers, json=body)
        r.raise_for_status()
        text = r.json()["choices"][0]["message"]["content"]
        return json.loads(_first_json(text))


def _first_json(text: str) -> str:
    start = text.find("{")
    end = text.rfind("}")
    return text[start:end + 1] if start >= 0 and end > start else "{}"
