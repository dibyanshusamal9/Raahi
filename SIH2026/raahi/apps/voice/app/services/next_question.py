"""FR-05 · Highest-info-gain next question.

We rank a small library of questions by how much they would reshape the
top-3. Concretely: for each question whose field is still UNKNOWN, we
simulate two extreme answers, re-rank, and pick the field whose two
outcomes disagree most in top-3 membership.

Cheap and deterministic. No model call. Runs on every turn."""
from __future__ import annotations
from typing import Callable
from ..db import q


# Ordered by prior usefulness — used both as fallback and as candidate list.
QUESTIONS = [
    # The welcome: who RAAHI is, what happens on the call, how the answers are
    # used, and a clear yes/no to begin (this is the consent question).
    ("consent",
     {"hi": "नमस्ते, RAAHI को कॉल करने के लिए धन्यवाद! मैं आपकी आजीविका सलाहकार हूँ। मैं आपसे आपके बारे में कुछ आसान सवाल पूछूँगी, और फिर आपके लिए सबसे सही प्रशिक्षण और काम बताऊँगी। आपकी जानकारी सिर्फ़ आपके लिए सही विकल्प ढूँढने में इस्तेमाल होगी। क्या हम शुरू करें?",
      "bn": "নমস্কার, RAAHI-তে ফোন করার জন্য ধন্যবাদ! আমি আপনার জীবিকা পরামর্শদাতা। আপনার সম্পর্কে কয়েকটি সহজ প্রশ্ন করব, তারপর আপনার জন্য সবচেয়ে উপযুক্ত প্রশিক্ষণ আর কাজের কথা বলব। আপনার তথ্য শুধু আপনার জন্য সঠিক বিকল্প খুঁজতে ব্যবহার হবে। শুরু করব?",
      "ta": "வணக்கம், RAAHI-ஐ அழைத்ததற்கு நன்றி! நான் உங்கள் வாழ்வாதார ஆலோசகர். உங்களைப் பற்றி சில எளிய கேள்விகள் கேட்டு, உங்களுக்கு மிகவும் பொருத்தமான பயிற்சியையும் வேலையையும் பரிந்துரைப்பேன். உங்கள் பதில்கள் உங்களுக்கான சரியான வாய்ப்புகளைக் கண்டறிய மட்டுமே பயன்படுத்தப்படும். தொடங்கலாமா?",
      "mr": "नमस्कार, RAAHI ला कॉल केल्याबद्दल धन्यवाद! मी तुमची उपजीविका सल्लागार आहे. मी तुम्हाला तुमच्याबद्दल काही सोपे प्रश्न विचारेन, आणि मग तुमच्यासाठी सर्वात योग्य प्रशिक्षण आणि काम सुचवेन. तुमची माहिती फक्त तुमच्यासाठी योग्य पर्याय शोधण्यासाठी वापरली जाईल. सुरू करूया का?",
      "or": "ନମସ୍କାର, RAAHIକୁ କଲ୍ କରିଥିବାରୁ ଧନ୍ୟବାଦ! ମୁଁ ଆପଣଙ୍କ ଜୀବିକା ପରାମର୍ଶଦାତା। ମୁଁ ଆପଣଙ୍କୁ ଆପଣଙ୍କ ବିଷୟରେ କିଛି ସହଜ ପ୍ରଶ୍ନ ପଚାରିବି, ଏବଂ ତା'ପରେ ଆପଣଙ୍କ ପାଇଁ ସବୁଠାରୁ ଉପଯୁକ୍ତ ତାଲିମ ଓ କାମ ବିଷୟରେ କହିବି। ଆପଣଙ୍କ ତଥ୍ୟ କେବଳ ଆପଣଙ୍କ ପାଇଁ ଠିକ୍ ବିକଳ୍ପ ଖୋଜିବାରେ ବ୍ୟବହାର ହେବ। ଆମେ ଆରମ୍ଭ କରିବା କି?",
      "en": "Namaste, and thank you for calling RAAHI! I'm your livelihood counsellor. I'll ask you a few simple questions about yourself, and then suggest the training and work that suit you best. Your answers are only used to find the right options for you. Shall we begin?"}),

    ("name",
     {"hi": "आपका नाम क्या है?",
      "bn": "আপনার নাম কী?",
      "ta": "உங்கள் பெயர் என்ன?",
      "mr": "तुमचं नाव काय आहे?",
      "or": "ଆପଣଙ୍କ ନାମ କ'ଣ?",
      "en": "What is your name?"}),

    ("home_district",
     {"hi": "आप किस ज़िले में रहते हैं?",
      "bn": "আপনি কোন জেলায় থাকেন?",
      "ta": "நீங்கள் எந்த மாவட்டத்தில் வசிக்கிறீர்கள்?",
      "mr": "तुम्ही कोणत्या जिल्ह्यात राहता?",
      "or": "ଆପଣ କେଉଁ ଜିଲ୍ଲାରେ ରୁହନ୍ତି?",
      "en": "Which district do you live in?"}),

    ("age",
     {"hi": "आपकी उम्र कितनी है?",
      "bn": "আপনার বয়স কত?",
      "ta": "உங்கள் வயது என்ன?",
      "mr": "तुमचं वय किती आहे?",
      "or": "ଆପଣଙ୍କ ବୟସ କେତେ?",
      "en": "How old are you?"}),

    ("education_class",
     {"hi": "आपने दसवीं पास की है या बारहवीं? या उससे आगे पढ़ाई की है?",
      "bn": "আপনি কি দশম পাস করেছেন নাকি দ্বাদশ? নাকি তার বেশি পড়েছেন?",
      "ta": "நீங்கள் பத்தாம் வகுப்பு தேர்ச்சி பெற்றீர்களா அல்லது பன்னிரண்டாம்? அல்லது அதற்கு மேல் படித்தீர்களா?",
      "mr": "तुम्ही दहावी पास केली आहे का बारावी? की त्याहून पुढे शिकला आहात?",
      "or": "ଆପଣ ଦଶମ ପାସ୍ କରିଛନ୍ତି ନା ଦ୍ୱାଦଶ? କିମ୍ବା ତା'ଠାରୁ ଅଧିକ ପଢ଼ିଛନ୍ତି?",
      "en": "Have you passed 10th or 12th? Or studied further?"}),

    ("aspiration",
     {"hi": "आप कैसा काम करना चाहेंगे — घर के पास या शहर में?",
      "bn": "আপনি কেমন কাজ চান — বাড়ির কাছে না শহরে?",
      "ta": "நீங்கள் எப்படிப்பட்ட வேலை விரும்புகிறீர்கள் — வீட்டுக்கு அருகில் அல்லது நகரத்தில்?",
      "mr": "तुम्हाला कसं काम हवं — घराजवळ की शहरात?",
      "or": "ଆପଣ କେଉଁଠି କାମ କରିବାକୁ ଚାହାଁନ୍ତି — ଘର ପାଖରେ ନା ସହରରେ?",
      "en": "What kind of work would you like — close to home, or in the city?"}),

    ("interests",
     {"hi": "आपको किन कामों में रुचि है? जैसे बुनाई, मोबाइल रिपेयर, बिजली का काम?",
      "bn": "কী ধরণের কাজে আপনার আগ্রহ? যেমন বুনন, মোবাইল সারানো, বৈদ্যুতিক কাজ?",
      "ta": "எந்த வகை வேலைகளில் ஆர்வம்? உதாரணமாக நெசவு, மொபைல் ரிப்பேர், மின்சாரம்?",
      "mr": "कोणत्या कामांत तुम्हाला रस आहे? विणकाम, मोबाइल दुरुस्ती, वीजकाम?",
      "or": "ଆପଣଙ୍କୁ କେଉଁ କାମରେ ଆଗ୍ରହ ଅଛି? ଯେପରିକି ବୁଣାକାମ, ମୋବାଇଲ୍ ମରାମତି, କିମ୍ବା ବିଜୁଳି କାମ?",
      "en": "What kind of work interests you? For example, weaving, mobile repair, or electrical work?"}),

    ("mobility_km",
     {"hi": "आप कितनी दूर तक जाने के लिए तैयार हैं — पास ही, दस बीस किलोमीटर, या शहर तक?",
      "bn": "আপনি কতদূর যেতে রাজি — কাছেই, ১০-২০ কিলোমিটার, না শহরে?",
      "ta": "நீங்கள் எவ்வளவு தூரம் செல்ல தயார் — அருகில், ১০-২০ கிமீ, அல்லது நகரத்திற்கு?",
      "mr": "तुम्ही किती अंतर जाण्यास तयार आहात — जवळच, दहा-वीस किमी, की शहरात?",
      "or": "ଆପଣ କେତେ ଦୂର ଯିବାକୁ ପ୍ରସ୍ତୁତ — ପାଖରେ, ଦଶ-କୋଡ଼ିଏ କିଲୋମିଟର, ନା ସହର ପର୍ଯ୍ୟନ୍ତ?",
      "en": "How far are you willing to travel — nearby, ten to twenty kilometres, or into the city?"}),

    ("has_smartphone",
     {"hi": "क्या आपके पास स्मार्टफोन है, या साधारण फोन?",
      "bn": "আপনার কি স্মার্টফোন আছে, না সাধারণ ফোন?",
      "ta": "உங்களிடம் ஸ்மார்ட்போன் உள்ளதா அல்லது சாதாரண போன்?",
      "mr": "तुमच्याकडे स्मार्टफोन आहे का साधा फोन?",
      "or": "ଆପଣଙ୍କ ପାଖରେ ସ୍ମାର୍ଟଫୋନ୍ ଅଛି, ନା ସାଧାରଣ ଫୋନ୍?",
      "en": "Do you have a smartphone, or a basic phone?"}),

    ("self_employ_ok",
     {"hi": "क्या आप अपना काम शुरू करना चाहेंगे, या नौकरी करना चाहेंगे?",
      "bn": "আপনি কি নিজের কাজ শুরু করতে চান, না চাকরি করতে চান?",
      "ta": "நீங்கள் சொந்த வேலை தொடங்க விரும்புகிறீர்களா அல்லது வேலைக்குச் செல்ல விரும்புகிறீர்களா?",
      "mr": "तुम्हाला स्वतःचं काम सुरू करायचं आहे का नोकरी?",
      "or": "ଆପଣ ନିଜର କାମ ଆରମ୍ଭ କରିବାକୁ ଚାହାଁନ୍ତି, ନା ଚାକିରି କରିବାକୁ ଚାହାଁନ୍ତି?",
      "en": "Would you like to start your own work, or take a salaried job?"}),

    ("social_category",
     {"hi": "क्या आप अनुसूचित जाति (SC), अनुसूचित जनजाति (ST), OBC या सामान्य वर्ग से हैं?",
      "bn": "আপনি কি SC, ST, OBC, না সাধারণ শ্রেণীর?",
      "ta": "நீங்கள் SC, ST, OBC அல்லது பொது வகுப்பு?",
      "mr": "तुम्ही SC, ST, OBC की सर्वसाधारण गटातले?",
      "or": "ଆପଣ SC, ST, OBC ନା ସାଧାରଣ ବର୍ଗର?",
      "en": "Do you belong to SC, ST, OBC, or the General category?"}),
]


# English base for every question — this is the single source of truth. The
# router translates it to the caller's language at send time (services/i18n),
# so a new language needs no edits here.
QUESTION_EN: dict[str, str] = {field: m["en"] for field, m in QUESTIONS}

# Human translations to pre-seed the translation cache, so the core languages
# stay instant and idiomatic. Shape: {english_text: {lang: translated}}.
SEED: dict[str, dict[str, str]] = {
    m["en"]: {lang: txt for lang, txt in m.items() if lang != "en"}
    for _field, m in QUESTIONS
}


def _text(field: str, language: str = "en") -> str:
    """Return the ENGLISH base question. Localisation is the router's job."""
    return QUESTION_EN.get(field, "")


def pick_next(profile: dict, asked: set[str], language: str = "en") -> tuple[str, str] | None:
    """Return (field_name, english_question_text) or None when done asking.
    The text is always English; the caller localises it."""
    # First turn ⇒ always consent
    if "consent" not in asked:
        return "consent", _text("consent", language)

    # Prioritise blocking unknowns needed by the ranker.
    ordering = ["name", "home_district", "age", "education_class", "aspiration",
                "interests", "mobility_km", "has_smartphone", "self_employ_ok",
                "social_category"]
    for f in ordering:
        if f in asked:
            continue
        if profile.get(f) in (None, [], ""):
            return f, _text(f, language)
    return None
