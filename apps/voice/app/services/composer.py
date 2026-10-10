"""FR-06 · Spoken result with reason per recommendation.

Composer LLM (Sarvam-M) reads the top-3 back in the beneficiary's language.
Guarantee: names, distances and centres are quoted from input rows — the
LLM only paraphrases the reason. If the LLM output drops or renames a
recommendation, we fall back to a deterministic template.
"""
from __future__ import annotations
import httpx, json
from ..settings import settings
from ..logging import log
from .persona import first_name


# Map an explainability check factor to the composer's reason vocabulary.
_FACTOR_TO_REASON = {
    "interest": "aspiration",
    "local_demand": "demand",
    "reachability": "mobility",
    "level_fit": "gap",
    "work_preference": "history",
}


def _reason_from_scores(row: dict) -> str:
    # Prefer a factor we actually CONFIRMED (from match_explain), so the spoken
    # reason is never a claim we couldn't verify — e.g. "matches your interest"
    # when no interest was stated. Fall back to the top raw sub-score.
    for check in row.get("checks") or []:
        if check.get("verdict") == "confirmed":
            key = _FACTOR_TO_REASON.get(check.get("factor"))
            if key:
                return key
    scores = {
        "aspiration": row.get("score_aspiration", 0),
        "demand": row.get("score_demand", 0),
        "mobility": row.get("score_mobility", 0),
        "gap": row.get("score_gap", 0),
        "history": row.get("score_history", 0),
    }
    return max(scores, key=scores.get)


TEMPLATES = {
    "hi": {
        "intro": "आपके लिए तीन सबसे अच्छे विकल्प ये हैं:",
        "intro_name": "{name} जी, आपके लिए तीन सबसे अच्छे विकल्प ये हैं:",
        "meta": "{sector}, NSQF स्तर {level}",
        "centre_km": "केंद्र: {centre}, लगभग {km} किमी",
        "centre": "केंद्र: {centre}",
        "nearest_tag": " (निकटतम उपलब्ध)",
        "why": "क्यों: {reason}",
        "reason_words": {"aspiration": "आपकी रुचि से मेल खाता है",
                         "demand": "आपके ज़िले में इसकी माँग है",
                         "mobility": "आपकी पहुँच के अंदर है",
                         "gap": "आपकी पढ़ाई के स्तर के हिसाब से सही है",
                         "history": "नौकरी या अपने काम की आपकी पसंद से मेल खाता है"},
        "reason_all": {"aspiration": "ये तीनों आपकी रुचि से मेल खाते हैं।",
                       "demand": "इन तीनों की आपके ज़िले में माँग है।",
                       "mobility": "ये तीनों आपकी पहुँच के अंदर हैं।",
                       "gap": "ये तीनों आपकी पढ़ाई के स्तर के हिसाब से सही हैं।",
                       "history": "ये तीनों नौकरी या अपने काम की आपकी पसंद से मेल खाते हैं।"},
        "outro": "पूरा विवरण आपको SMS और WhatsApp पर मिल जाएगा।",
        "closing": "RAAHI को कॉल करने के लिए धन्यवाद। आपको शुभकामनाएँ!",
    },
    "en": {
        "intro": "Here are your three best options:",
        "intro_name": "{name}, here are your three best options:",
        "meta": "{sector}, NSQF level {level}",
        "centre_km": "Centre: {centre}, about {km} km away",
        "centre": "Centre: {centre}",
        "nearest_tag": " (nearest available)",
        "why": "Why: {reason}",
        "reason_words": {"aspiration": "it matches your interest",
                         "demand": "there is demand in your district",
                         "mobility": "it is within your reach",
                         "gap": "it suits your education level",
                         "history": "it fits your choice of a job or your own work"},
        "reason_all": {"aspiration": "All three match your interest.",
                       "demand": "All three are in demand in your district.",
                       "mobility": "All three are within your reach.",
                       "gap": "All three suit your education level.",
                       "history": "All three fit your choice of a job or your own work."},
        "outro": "You will receive the full details on SMS and WhatsApp.",
        "closing": "Thank you for calling RAAHI. All the best!",
    },
    "bn": {
        "intro": "আপনার জন্য সেরা তিনটি বিকল্প:",
        "intro_name": "{name}, আপনার জন্য সেরা তিনটি বিকল্প:",
        "meta": "{sector}, NSQF স্তর {level}",
        "centre_km": "কেন্দ্র: {centre}, প্রায় {km} কিমি দূরে",
        "centre": "কেন্দ্র: {centre}",
        "nearest_tag": " (নিকটতম উপলব্ধ)",
        "why": "কেন: {reason}",
        "reason_words": {"aspiration": "আপনার আগ্রহের সাথে মিলে যায়",
                         "demand": "আপনার জেলায় এর চাহিদা আছে",
                         "mobility": "আপনার নাগালে আছে",
                         "gap": "আপনার পড়াশোনার স্তরের সাথে মানানসই",
                         "history": "চাকরি না নিজের কাজ — আপনার পছন্দের সাথে মেলে"},
        "reason_all": {"aspiration": "তিনটিই আপনার আগ্রহের সাথে মেলে।",
                       "demand": "তিনটিরই আপনার জেলায় চাহিদা আছে।",
                       "mobility": "তিনটিই আপনার নাগালের মধ্যে।",
                       "gap": "তিনটিই আপনার পড়াশোনার স্তরের সাথে মানানসই।",
                       "history": "তিনটিই চাকরি না নিজের কাজ — আপনার পছন্দের সাথে মেলে।"},
        "outro": "সম্পূর্ণ বিবরণ আপনি SMS ও WhatsApp-এ পেয়ে যাবেন।",
        "closing": "RAAHI-তে ফোন করার জন্য ধন্যবাদ। শুভকামনা রইল!",
    },
    "ta": {
        "intro": "உங்களுக்கான மூன்று சிறந்த வாய்ப்புகள்:",
        "intro_name": "{name}, உங்களுக்கான மூன்று சிறந்த வாய்ப்புகள்:",
        "meta": "{sector}, NSQF நிலை {level}",
        "centre_km": "மையம்: {centre}, சுமார் {km} கிமீ தொலைவில்",
        "centre": "மையம்: {centre}",
        "nearest_tag": " (அருகிலுள்ள கிடைக்கும் மையம்)",
        "why": "ஏன்: {reason}",
        "reason_words": {"aspiration": "உங்கள் ஆர்வத்துடன் பொருந்துகிறது",
                         "demand": "உங்கள் மாவட்டத்தில் தேவை உள்ளது",
                         "mobility": "உங்கள் அணுகலுக்குள் உள்ளது",
                         "gap": "உங்கள் படிப்பு நிலைக்கு ஏற்றது",
                         "history": "வேலை அல்லது சொந்தத் தொழில் — உங்கள் விருப்பத்துடன் பொருந்துகிறது"},
        "reason_all": {"aspiration": "மூன்றும் உங்கள் ஆர்வத்துடன் பொருந்துகின்றன.",
                       "demand": "மூன்றுக்கும் உங்கள் மாவட்டத்தில் தேவை உள்ளது.",
                       "mobility": "மூன்றும் உங்கள் அணுகலுக்குள் உள்ளன.",
                       "gap": "மூன்றும் உங்கள் படிப்பு நிலைக்கு ஏற்றவை.",
                       "history": "மூன்றும் வேலை அல்லது சொந்தத் தொழில் என்ற உங்கள் விருப்பத்துடன் பொருந்துகின்றன."},
        "outro": "முழு விவரங்கள் SMS மற்றும் WhatsApp-இல் கிடைக்கும்.",
        "closing": "RAAHI-ஐ அழைத்ததற்கு நன்றி. வாழ்த்துகள்!",
    },
    "mr": {
        "intro": "तुमच्यासाठी तीन सर्वोत्तम पर्याय:",
        "intro_name": "{name}, तुमच्यासाठी तीन सर्वोत्तम पर्याय:",
        "meta": "{sector}, NSQF स्तर {level}",
        "centre_km": "केंद्र: {centre}, सुमारे {km} किमी",
        "centre": "केंद्र: {centre}",
        "nearest_tag": " (जवळचे उपलब्ध)",
        "why": "का: {reason}",
        "reason_words": {"aspiration": "तुमच्या आवडीशी जुळते",
                         "demand": "तुमच्या जिल्ह्यात मागणी आहे",
                         "mobility": "तुमच्या पोहोचात आहे",
                         "gap": "तुमच्या शिक्षणाच्या पातळीला साजेसे आहे",
                         "history": "नोकरी की स्वतःचं काम — तुमच्या निवडीशी जुळते"},
        "reason_all": {"aspiration": "तिन्ही पर्याय तुमच्या आवडीशी जुळतात.",
                       "demand": "तिन्ही पर्यायांना तुमच्या जिल्ह्यात मागणी आहे.",
                       "mobility": "तिन्ही पर्याय तुमच्या पोहोचात आहेत.",
                       "gap": "तिन्ही पर्याय तुमच्या शिक्षणाच्या पातळीला साजेसे आहेत.",
                       "history": "तिन्ही पर्याय नोकरी की स्वतःचं काम या तुमच्या निवडीशी जुळतात."},
        "outro": "पूर्ण तपशील तुम्हाला SMS आणि WhatsApp वर मिळतील.",
        "closing": "RAAHI ला कॉल केल्याबद्दल धन्यवाद. तुम्हाला शुभेच्छा!",
    },
    "or": {
        "intro": "ଆପଣଙ୍କ ପାଇଁ ତିନୋଟି ସବୁଠାରୁ ଭଲ ବିକଳ୍ପ:",
        "intro_name": "{name}, ଆପଣଙ୍କ ପାଇଁ ତିନୋଟି ସବୁଠାରୁ ଭଲ ବିକଳ୍ପ:",
        "meta": "{sector}, NSQF ସ୍ତର {level}",
        "centre_km": "କେନ୍ଦ୍ର: {centre}, ପ୍ରାୟ {km} କିମି",
        "centre": "କେନ୍ଦ୍ର: {centre}",
        "nearest_tag": " (ନିକଟତମ ଉପଲବ୍ଧ)",
        "why": "କାହିଁକି: {reason}",
        "reason_words": {"aspiration": "ଆପଣଙ୍କ ଆଗ୍ରହ ସହ ମେଳ ଖାଏ",
                         "demand": "ଆପଣଙ୍କ ଜିଲ୍ଲାରେ ଏହାର ଚାହିଦା ଅଛି",
                         "mobility": "ଆପଣଙ୍କ ପହଞ୍ଚ ଭିତରେ ଅଛି",
                         "gap": "ଆପଣଙ୍କ ପାଠପଢ଼ା ସ୍ତର ପାଇଁ ଉପଯୁକ୍ତ",
                         "history": "ଚାକିରି ନା ନିଜ କାମ — ଆପଣଙ୍କ ପସନ୍ଦ ସହ ମେଳ ଖାଏ"},
        "reason_all": {"aspiration": "ତିନୋଟିଯାକ ଆପଣଙ୍କ ଆଗ୍ରହ ସହ ମେଳ ଖାଏ।",
                       "demand": "ତିନୋଟିଯାକର ଆପଣଙ୍କ ଜିଲ୍ଲାରେ ଚାହିଦା ଅଛି।",
                       "mobility": "ତିନୋଟିଯାକ ଆପଣଙ୍କ ପହଞ୍ଚ ଭିତରେ ଅଛି।",
                       "gap": "ତିନୋଟିଯାକ ଆପଣଙ୍କ ପାଠପଢ଼ା ସ୍ତର ପାଇଁ ଉପଯୁକ୍ତ।",
                       "history": "ତିନୋଟିଯାକ ଚାକିରି ନା ନିଜ କାମ — ଆପଣଙ୍କ ପସନ୍ଦ ସହ ମେଳ ଖାଏ।"},
        "outro": "ସମ୍ପୂର୍ଣ୍ଣ ବିବରଣୀ ଆପଣ SMS ଓ WhatsAppରେ ପାଇବେ।",
        "closing": "RAAHIକୁ କଲ୍ କରିଥିବାରୁ ଧନ୍ୟବାଦ। ଶୁଭକାମନା!",
    },
}

# Said once, after the options, when the centres need explaining.
_NO_CENTRE_NOTES = {
    "en": "No training centre teaches these courses yet — a mobiliser will contact you to confirm enrollment.",
    "hi": "अभी कोई प्रशिक्षण केंद्र ये कोर्स नहीं सिखाता — नामांकन की पुष्टि के लिए एक साथी आपसे संपर्क करेगा।",
    "bn": "এখনো কোনো প্রশিক্ষণ কেন্দ্র এই কোর্সগুলি শেখায় না — নামভর্তির বিষয়ে একজন সমন্বয়ক যোগাযোগ করবেন।",
    "ta": "இந்தப் படிப்புகளை இன்னும் எந்த பயிற்சி மையமும் கற்பிக்கவில்லை — சேர்க்கையை உறுதிப்படுத்த ஒருவர் உங்களைத் தொடர்புகொள்வார்.",
    "mr": "हे अभ्यासक्रम अजून कोणतेही प्रशिक्षण केंद्र शिकवत नाही — प्रवेश निश्चित करण्यासाठी एक सहकारी तुमच्याशी संपर्क करेल.",
    "or": "ଏବେ କୌଣସି ତାଲିମ କେନ୍ଦ୍ର ଏହି ପାଠ୍ୟକ୍ରମ ଶିଖାଉନାହିଁ — ନାମ ଲେଖାଇବା ନିଶ୍ଚିତ କରିବାକୁ ଜଣେ ସହକର୍ମୀ ଆପଣଙ୍କ ସହ ଯୋଗାଯୋଗ କରିବେ।",
}
_NEAREST_NOTES = {
    "en": "No centre in your district ({district}) teaches these courses yet, so these are the nearest centres that do.",
    "hi": "आपके ज़िले ({district}) का कोई केंद्र अभी ये कोर्स नहीं सिखाता, इसलिए ये सबसे नज़दीकी केंद्र हैं जो इन्हें सिखाते हैं।",
    "bn": "আপনার জেলার ({district}) কোনো কেন্দ্র এখনো এই কোর্সগুলি শেখায় না, তাই এগুলি সবচেয়ে কাছের কেন্দ্র যেগুলি শেখায়।",
    "ta": "உங்கள் மாவட்டத்தில் ({district}) உள்ள எந்த மையமும் இன்னும் இந்தப் படிப்புகளைக் கற்பிக்கவில்லை, எனவே அவற்றைக் கற்பிக்கும் அருகிலுள்ள மையங்கள் இவை.",
    "mr": "तुमच्या जिल्ह्यातील ({district}) कोणतेही केंद्र अजून हे अभ्यासक्रम शिकवत नाही, म्हणून ते शिकवणारी ही सर्वात जवळची केंद्रे आहेत.",
    "or": "ଆପଣଙ୍କ ଜିଲ୍ଲା ({district})ର କୌଣସି କେନ୍ଦ୍ର ଏବେ ଏହି ପାଠ୍ୟକ୍ରମ ଶିଖାଉନାହିଁ, ତେଣୁ ଏଗୁଡ଼ିକ ସବୁଠାରୁ ନିକଟ କେନ୍ଦ୍ର ଯେଉଁଠି ଏହା ଶିଖାଯାଏ।",
}


def render_template(top3: list[dict], language: str = "hi",
                    beneficiary: dict | None = None) -> str:
    """The results, laid out to be easy to read and to listen to: a greeting
    by name, then each option on its own short lines (course; sector and
    level; centre), the reason said once when all three share it, one note
    about the centres if needed, and the outro. Lines are separated by
    newlines (shown as line breaks, heard as pauses)."""
    t = TEMPLATES.get(language) or TEMPLATES["en"]
    lang = language if language in TEMPLATES else "en"
    ben = beneficiary or {}
    name = first_name(ben.get("name"))
    district = ben.get("home_district") or ""

    have_any_centre = any(r.get("centre_name") for r in top3)
    have_local_centre = any(r.get("centre_name") and not r.get("nearest_fallback")
                            for r in top3)
    reasons = [_reason_from_scores(r) for r in top3]
    same_reason = len(top3) > 1 and len(set(reasons)) == 1

    lines = [t["intro_name"].format(name=name) if name else t["intro"]]
    for i, r in enumerate(top3):
        lines.append("")
        lines.append(f"{i + 1}. {r.get('qualification_name') or r.get('qp_code') or '—'}")
        lines.append(t["meta"].format(sector=r.get("sector") or "—",
                                      level=r.get("nsqf_level") or "—"))
        centre = r.get("centre_name")
        if centre:
            place = [p for p in (r.get("centre_district"), r.get("centre_state")) if p]
            if len(place) == 2 and place[0] == place[1]:
                place = place[:1]
            label = f"{centre} ({', '.join(place)})" if place else centre
            # Tag a far-away centre only when other options are local; when all
            # of them are far, the note below says it once.
            if r.get("nearest_fallback") and have_local_centre:
                label += t["nearest_tag"]
            km = r.get("distance_km")
            lines.append(t["centre_km"].format(centre=label, km=km) if km is not None
                         else t["centre"].format(centre=label))
        if not same_reason:
            lines.append(t["why"].format(reason=t["reason_words"][reasons[i]]))

    lines.append("")
    if same_reason:
        lines.append(t["reason_all"][reasons[0]])
    if not have_any_centre:
        lines.append(_NO_CENTRE_NOTES[lang])
    elif not have_local_centre:
        lines.append(_NEAREST_NOTES[lang].format(district=district))
    lines.append(t["outro"])
    lines.append(t["closing"])
    return "\n".join(lines).strip()


async def compose(top3: list[dict], language: str, profile: dict) -> str:
    """Render the spoken result. For the languages with a native template
    (en/hi/bn/ta/mr) render directly — no network, fully offline. For any
    other scheduled language render English and let the router translate it
    via i18n (which needs Sarvam translate credits; without them it safely
    falls back to English)."""
    lang = (language or "en").lower()
    if lang in TEMPLATES:
        return render_template(top3, lang, beneficiary=profile)
    return render_template(top3, "en", beneficiary=profile)


def _mentions_all(text: str, top3: list[dict]) -> bool:
    if not text:
        return False
    t = text.lower()
    for r in top3:
        n = (r.get("qualification_name") or "").lower()
        if not n:
            continue
        first_two = " ".join(n.split()[:2])
        if first_two and first_two not in t:
            return False
    return True


async def _sarvam_compose(top3: list[dict], language: str, profile: dict) -> str:
    url = "https://api.sarvam.ai/v1/chat/completions"
    headers = {"api-subscription-key": settings.sarvam_api_key}
    lang_name = {"hi": "Hindi", "bn": "Bengali", "ta": "Tamil", "mr": "Marathi",
                 "en": "English", "te": "Telugu", "gu": "Gujarati",
                 "kn": "Kannada", "ml": "Malayalam", "pa": "Punjabi"}.get(language, "Hindi")
    system = (f"You are a kind counsellor speaking to a beneficiary in {lang_name}. "
              f"Reply ONLY in {lang_name}. "
              "Read out THREE recommendations, in order, in 4-6 short sentences total. "
              "For each, mention the qualification NAME EXACTLY as given, the sector, "
              "the centre name and distance in km, and ONE reason from its scores. "
              "Do not add, drop, or rename recommendations.")
    user = "Recommendations:\n" + json.dumps(top3, ensure_ascii=False, default=str)
    body = {"model": settings.sarvam_llm_model,
            "messages": [{"role": "system", "content": system},
                         {"role": "user", "content": user}]}
    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.post(url, headers=headers, json=body)
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]
