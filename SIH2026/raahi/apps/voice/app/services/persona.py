"""RAAHI's voice between the interview questions.

RAAHI is a counsellor answering a phone call, so these lines are phone-agent
lines: a short acknowledgement of each answer (using the caller's name once
they have given it), a gentle consent reminder, and a "please stay on the
line" just before the results.

Native text for en/hi/bn/ta/mr/or. Other languages get the English line,
which the router translates exactly like every other prompt.
"""
from __future__ import annotations

NATIVE = ("en", "hi", "bn", "ta", "mr", "or")

# Sector words the extractor stores next to what the caller actually said
# ("mobile repair" + "telecom"). For an acknowledgement, the caller's own
# words read far better than the sector name.
_SECTOR_TOKENS = {
    "telecom", "apparel", "handloom", "electronics", "beauty & wellness",
    "agriculture", "construction", "retail", "healthcare", "automotive",
    "logistics", "tourism", "it", "bfsi", "food processing",
}

# field just answered -> {lang: line}. {name}, {district} and {interest} are
# filled from the caller's profile.
_ACKS: dict[str, dict[str, str]] = {
    "consent": {
        "en": "Wonderful, let's begin!",
        "hi": "बहुत बढ़िया, चलिए शुरू करते हैं!",
        "bn": "খুব ভালো, চলুন শুরু করি!",
        "ta": "அருமை, தொடங்குவோம்!",
        "mr": "छान, चला सुरू करूया!",
        "or": "ବହୁତ ଭଲ, ଚାଲନ୍ତୁ ଆରମ୍ଭ କରିବା!",
    },
    "name": {
        "en": "Thank you, {name}! It's nice talking to you.",
        "hi": "धन्यवाद, {name} जी! आपसे बात करके अच्छा लगा।",
        "bn": "ধন্যবাদ, {name}! আপনার সঙ্গে কথা বলে ভালো লাগছে।",
        "ta": "நன்றி, {name}! உங்களுடன் பேசுவதில் மகிழ்ச்சி.",
        "mr": "धन्यवाद, {name}! तुमच्याशी बोलून छान वाटलं.",
        "or": "ଧନ୍ୟବାଦ, {name}! ଆପଣଙ୍କ ସହ କଥା ହୋଇ ଭଲ ଲାଗିଲା।",
    },
    "home_district": {
        "en": "{district} — got it.",
        "hi": "अच्छा, {district}।",
        "bn": "আচ্ছা, {district}।",
        "ta": "சரி, {district}.",
        "mr": "बरं, {district}.",
        "or": "ଆଚ୍ଛା, {district}।",
    },
    "age": {
        "en": "Alright, {name}.",
        "hi": "ठीक है, {name} जी।",
        "bn": "আচ্ছা, {name}।",
        "ta": "சரி, {name}.",
        "mr": "बरं, {name}.",
        "or": "ଠିକ୍ ଅଛି, {name}।",
    },
    "education_class": {
        "en": "That's great.",
        "hi": "बहुत अच्छे।",
        "bn": "খুব ভালো।",
        "ta": "மிகவும் நல்லது.",
        "mr": "खूप छान.",
        "or": "ବହୁତ ଭଲ।",
    },
    "aspiration": {
        "en": "Understood.",
        "hi": "समझ गई।",
        "bn": "বুঝেছি।",
        "ta": "புரிந்தது.",
        "mr": "समजलं.",
        "or": "ବୁଝିଗଲି।",
    },
    "interests": {
        "en": "{interest} — that's a good choice!",
        "hi": "{interest} — बढ़िया चुनाव है!",
        "bn": "{interest} — দারুণ পছন্দ!",
        "ta": "{interest} — நல்ல தேர்வு!",
        "mr": "{interest} — चांगली निवड!",
        "or": "{interest} — ବହୁତ ଭଲ ପସନ୍ଦ!",
    },
    "mobility_km": {
        "en": "Okay.",
        "hi": "ठीक है।",
        "bn": "ঠিক আছে।",
        "ta": "சரி.",
        "mr": "ठीक आहे.",
        "or": "ଠିକ୍ ଅଛି।",
    },
    "has_smartphone": {
        "en": "Okay, noted.",
        "hi": "ठीक है, नोट कर लिया।",
        "bn": "ঠিক আছে, লিখে নিলাম।",
        "ta": "சரி, குறித்துக்கொண்டேன்.",
        "mr": "ठीक आहे, नोंद केली.",
        "or": "ଠିକ୍ ଅଛି, ଲେଖିନେଲି।",
    },
    "self_employ_ok": {
        "en": "Got it.",
        "hi": "समझ गई।",
        "bn": "বুঝেছি।",
        "ta": "புரிந்தது.",
        "mr": "समजलं.",
        "or": "ବୁଝିଗଲି।",
    },
}

# Used when a line above needs a value the caller hasn't given.
_ACKS_PLAIN: dict[str, dict[str, str]] = {
    "age": {
        "en": "Alright.", "hi": "ठीक है।", "bn": "আচ্ছা।",
        "ta": "சரி.", "mr": "बरं.", "or": "ଠିକ୍ ଅଛି।",
    },
    "interests": {
        "en": "That's a good choice!", "hi": "बढ़िया चुनाव है!", "bn": "দারুণ পছন্দ!",
        "ta": "நல்ல தேர்வு!", "mr": "चांगली निवड!", "or": "ବହୁତ ଭଲ ପସନ୍ଦ!",
    },
}

# Spoken once all the questions are answered, just before the results.
_FILLER: dict[str, tuple[str, str]] = {   # (with name, without)
    "en": ("Thank you, {name}! Please stay on the line for a moment — I'm finding the three best options for you.",
           "Thank you! Please stay on the line for a moment — I'm finding the three best options for you."),
    "hi": ("धन्यवाद, {name} जी! कृपया एक पल लाइन पर बने रहिए — मैं आपके लिए तीन सबसे अच्छे विकल्प ढूँढ रही हूँ।",
           "धन्यवाद! कृपया एक पल लाइन पर बने रहिए — मैं आपके लिए तीन सबसे अच्छे विकल्प ढूँढ रही हूँ।"),
    "bn": ("ধন্যবাদ, {name}! অনুগ্রহ করে একটু লাইনে থাকুন — আমি আপনার জন্য সেরা তিনটি বিকল্প খুঁজছি।",
           "ধন্যবাদ! অনুগ্রহ করে একটু লাইনে থাকুন — আমি আপনার জন্য সেরা তিনটি বিকল্প খুঁজছি।"),
    "ta": ("நன்றி, {name}! தயவுசெய்து ஒரு நிமிடம் லைனில் இருங்கள் — உங்களுக்கான மூன்று சிறந்த வாய்ப்புகளைத் தேடுகிறேன்.",
           "நன்றி! தயவுசெய்து ஒரு நிமிடம் லைனில் இருங்கள் — உங்களுக்கான மூன்று சிறந்த வாய்ப்புகளைத் தேடுகிறேன்."),
    "mr": ("धन्यवाद, {name}! कृपया एक क्षण लाईनवर राहा — मी तुमच्यासाठी तीन सर्वोत्तम पर्याय शोधत आहे.",
           "धन्यवाद! कृपया एक क्षण लाईनवर राहा — मी तुमच्यासाठी तीन सर्वोत्तम पर्याय शोधत आहे."),
    "or": ("ଧନ୍ୟବାଦ, {name}! ଦୟାକରି କିଛି ସମୟ ଲାଇନରେ ରୁହନ୍ତୁ — ମୁଁ ଆପଣଙ୍କ ପାଇଁ ତିନୋଟି ସବୁଠାରୁ ଭଲ ବିକଳ୍ପ ଖୋଜୁଛି।",
           "ଧନ୍ୟବାଦ! ଦୟାକରି କିଛି ସମୟ ଲାଇନରେ ରୁହନ୍ତୁ — ମୁଁ ଆପଣଙ୍କ ପାଇଁ ତିନୋଟି ସବୁଠାରୁ ଭଲ ବିକଳ୍ପ ଖୋଜୁଛି।"),
}

# Asked again when the caller's reply to the welcome wasn't a clear yes —
# repeating the whole welcome would be tiring.
CONSENT_AGAIN: dict[str, str] = {
    "en": "Shall we begin? Please say 'yes' to continue.",
    "hi": "क्या हम शुरू करें? आगे बढ़ने के लिए 'हाँ' कहिए।",
    "bn": "শুরু করব? এগোতে 'হ্যাঁ' বলুন।",
    "ta": "தொடங்கலாமா? தொடர 'ஆம்' என்று சொல்லுங்கள்.",
    "mr": "सुरू करूया का? पुढे जाण्यासाठी 'हो' म्हणा.",
    "or": "ଆମେ ଆରମ୍ଭ କରିବା କି? ଆଗକୁ ବଢ଼ିବା ପାଇଁ ଦୟାକରି 'ହଁ' କୁହନ୍ତୁ।",
}


def first_name(name: str | None) -> str:
    """'nitesh kumar' -> 'Nitesh'. Non-Latin names are left as written."""
    parts = (name or "").strip().split()
    if not parts:
        return ""
    first = parts[0]
    return first[:1].upper() + first[1:] if first.isascii() else first


def _interest(ben: dict) -> str:
    items = [str(i).strip() for i in (ben.get("interests") or []) if str(i).strip()]
    own = [i for i in items if i.lower() not in _SECTOR_TOKENS]
    return (own or items or [""])[0]


def _lang(lang: str | None) -> str:
    lang = (lang or "en").lower()
    return lang if lang in NATIVE else "en"


def ack(field: str | None, ben: dict, lang: str | None) -> str:
    """Short acknowledgement of the answer to `field`, in `lang` when it is a
    native language, else in English (the router translates it). Returns ''
    when there is nothing natural to say."""
    if not field or field not in _ACKS:
        return ""
    lang = _lang(lang)
    values = {"name": first_name(ben.get("name")),
              "district": (ben.get("home_district") or "").strip(),
              "interest": _interest(ben)}
    line = _ACKS[field][lang]
    for key, value in values.items():
        if "{" + key + "}" in line and not value:
            line = _ACKS_PLAIN.get(field, {}).get(lang, "")
            break
    return line.format(**values) if line else ""


def filler(ben: dict, lang: str | None) -> str:
    """The personal 'please stay on the line' spoken before the results."""
    with_name, plain = _FILLER[_lang(lang)]
    name = first_name(ben.get("name"))
    return with_name.format(name=name) if name else plain


def consent_again(lang: str | None) -> str:
    return CONSENT_AGAIN[_lang(lang)]
