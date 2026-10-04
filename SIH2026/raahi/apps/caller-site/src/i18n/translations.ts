import { TranslationData, LanguageCode } from "./types";

export const translations: Record<LanguageCode, TranslationData> = {
  en: {
    nav: { about: "About RAAHI", help: "How RAAHI Helps", stories: "Success Stories" },
    hero: {
      roadHeading: "No forms.\nNo apps.\nNo reading required.",
      roadBody: "Just a road, a phone number, and someone who listens in your own language.",
      discoveryHeading: "Help was always\nthis close.",
      discoveryBody: "RAAHI listens, understands, and finds the training that fits your life."
    },
    loading: { preparing: "Preparing your journey..." },
    cta: { callTollFree: "Call RAAHI toll-free" },
    call: {
      ringing: "Ringing...", connected: "Connected", greeting1: "Hello, I'm RAAHI.", greeting2: "How can I help you today?",
      connecting: "Connecting", callEnded: "Call Ended", livelihoodCounselor: "Livelihood Counsellor",
      profilePrepared: "Livelihood profile prepared.", returnHome: "Return to Homepage", matchFound: "NSQF Match Found", confidence: "{score}% Confidence", center: "PMKK Nalanda (4.2 km)",
      nextBatch: "12 Oct", sentWhatsapp: "Livelihood Pack sent via WhatsApp", qDistrict: "Which district are you calling from?",
      aDistrict: "From Nalanda.", qPreference: "Would you like to do any work other than farming?", aPreference: "Yes, I want to learn mobile repairing.",
      jobRole: "Smartphone Repair Technician"
    },
    direction: "ltr"
  },
  hi: {
    nav: { about: "राही के बारे में", help: "राही कैसे मदद करता है", stories: "सफलता की कहानियाँ" },
    hero: {
      roadHeading: "कोई फॉर्म नहीं।\nकोई ऐप नहीं।\nपढ़ने की जरूरत नहीं।",
      roadBody: "बस एक रास्ता, एक फोन नंबर, और कोई जो आपकी अपनी भाषा में सुनता है।",
      discoveryHeading: "मदद हमेशा\nइतनी करीब थी।",
      discoveryBody: "राही सुनता है, समझता है, और ऐसा प्रशिक्षण ढूंढता है जो आपके जीवन के अनुकूल हो।"
    },
    loading: { preparing: "आपका रास्ता तैयार हो रहा है..." },
    cta: { callTollFree: "राही को मुफ्त कॉल करें" },
    call: {
      ringing: "रिंग हो रहा है...", connected: "जुड़ गया", greeting1: "नमस्ते! मैं राही हूँ।", greeting2: "मैं आपकी कैसे मदद कर सकती हूँ?",
      connecting: "जोड़ रहा है", callEnded: "कॉल समाप्त", livelihoodCounselor: "आजीविका सलाहकार",
      profilePrepared: "आजीविका प्रोफ़ाइल तैयार है।", returnHome: "होमपेज पर लौटें", matchFound: "NSQF मैच मिला", confidence: "{score}% कॉन्फिडेंस", center: "PMKK नालंदा (4.2 किमी)",
      nextBatch: "12 अक्टूबर", sentWhatsapp: "आजीविका पैक WhatsApp के माध्यम से भेजा गया", qDistrict: "आप किस जिले से बात कर रहे हैं?",
      aDistrict: "नालंदा से।", qPreference: "क्या आप खेती के अलावा कोई काम करना चाहेंगे?", aPreference: "हाँ, मैं मोबाइल रिपेयरिंग सीखना चाहता हूँ।",
      jobRole: "स्मार्टफोन रिपेयर तकनीशियन"
    },
    direction: "ltr"
  },
  bn: {
    nav: { about: "রাহী সম্পর্কে", help: "রাহী কীভাবে সাহায্য করে", stories: "সাফল্যের গল্প" },
    hero: {
      roadHeading: "কোনো ফর্ম নেই।\nকোনো অ্যাপ নেই।\nপড়ার দরকার নেই।",
      roadBody: "শুধু একটা রাস্তা, একটা ফোন নম্বর, আর এমন কেউ যে আপনার নিজের ভাষায় শোনে।",
      discoveryHeading: "সাহায্য সবসময়\nএত কাছেই ছিল।",
      discoveryBody: "রাহী শোনে, বোঝে এবং এমন প্রশিক্ষণ খুঁজে বের করে যা আপনার জীবনের সাথে মানানসই।"
    },
    loading: { preparing: "আপনার যাত্রা প্রস্তুত করা হচ্ছে..." },
    cta: { callTollFree: "রাহীকে টোল-ফ্রি কল করুন" },
    call: {
      ringing: "রিং হচ্ছে...", connected: "সংযুক্ত", greeting1: "নমস্কার! আমি রাহী।", greeting2: "আমি আপনাকে কীভাবে সাহায্য করতে পারি?",
      connecting: "সংযুক্ত হচ্ছে", callEnded: "কল শেষ", livelihoodCounselor: "জীবিকা পরামর্শদাতা",
      profilePrepared: "জীবিকা প্রোফাইল প্রস্তুত।", returnHome: "হোমপেজে ফিরে যান", matchFound: "NSQF ম্যাচ পাওয়া গেছে", confidence: "{score}% কনফিডেন্স", center: "PMKK নালন্দা (৪.২ কিমি)",
      nextBatch: "১২ অক্টোবর", sentWhatsapp: "WhatsApp-এর মাধ্যমে জীবিকা প্যাক পাঠানো হয়েছে", qDistrict: "আপনি কোন জেলা থেকে বলছেন?",
      aDistrict: "নালন্দা থেকে।", qPreference: "আপনি কি চাষাবাদ ছাড়া অন্য কোনো কাজ করতে চান?", aPreference: "হ্যাঁ, আমি মোবাইল মেরামত শিখতে চাই।",
      jobRole: "স্মার্টফোন মেরামত টেকনিশিয়ান"
    },
    direction: "ltr"
  },
  gu: {
    nav: { about: "રાહી વિશે", help: "રાહી કેવી રીતે મદદ કરે છે", stories: "સફળતાની વાર્તાઓ" },
    hero: {
      roadHeading: "કોઈ ફોર્મ નથી.\nકોઈ એપ નથી.\nવાંચવાની જરૂર નથી.",
      roadBody: "ફક્ત એક રસ્તો, એક ફોન નંબર, અને કોઈ એવું જે તમારી પોતાની ભાષામાં સાંભળે છે.",
      discoveryHeading: "મદદ હંમેશા\nઆટલી નજીક હતી.",
      discoveryBody: "રાહી સાંભળે છે, સમજે છે અને એવી તાલીમ શોધે છે જે તમારા જીવનને અનુકૂળ હોય."
    },
    loading: { preparing: "તમારો રસ્તો તૈયાર થઈ રહ્યો છે..." },
    cta: { callTollFree: "રાહીને ટોલ-ફ્રી કૉલ કરો" },
    call: {
      ringing: "રિંગ વાગી રહી છે...", connected: "જોડાયેલું", greeting1: "નમસ્તે! હું રાહી છું.", greeting2: "હું તમારી કેવી રીતે મદદ કરી શકું?",
      connecting: "જોડાઈ રહ્યું છે", callEnded: "કૉલ સમાપ્ત", livelihoodCounselor: "આજીવિકા સલાહકાર",
      profilePrepared: "આજીવિકા પ્રોફાઇલ તૈયાર છે.", returnHome: "હોમપેજ પર પાછા ફરો", matchFound: "NSQF મેચ મળ્યો", confidence: "{score}% કૉન્ફિડન્સ", center: "PMKK નાલંદા (4.2 કિમી)",
      nextBatch: "12 ઑક્ટોબર", sentWhatsapp: "WhatsApp દ્વારા આજીવિકા પેક મોકલવામાં આવ્યું", qDistrict: "તમે કયા જિલ્લામાંથી વાત કરી રહ્યા છો?",
      aDistrict: "નાલંદાથી.", qPreference: "શું તમે ખેતી સિવાય બીજું કોઈ કામ કરવા માંગો છો?", aPreference: "હા, મારે મોબાઇલ રિપેરિંગ શીખવું છે.",
      jobRole: "સ્માર્ટફોન રિપેર ટેકનિશિયન"
    },
    direction: "ltr"
  },
  kn: {
    nav: { about: "ರಾಹಿಯ ಬಗ್ಗೆ", help: "ರಾಹಿ ಹೇಗೆ ಸಹಾಯ ಮಾಡುತ್ತದೆ", stories: "ಯಶಸ್ಸಿನ ಕಥೆಗಳು" },
    hero: {
      roadHeading: "ಯಾವುದೇ ಫಾರ್ಮ್‌ಗಳಿಲ್ಲ.\nಯಾವುದೇ ಅಪ್ಲಿಕೇಶನ್‌ಗಳಿಲ್ಲ.\nಓದುವ ಅಗತ್ಯವಿಲ್ಲ.",
      roadBody: "ಕೇವಲ ಒಂದು ರಸ್ತೆ, ಒಂದು ಫೋನ್ ಸಂಖ್ಯೆ ಮತ್ತು ನಿಮ್ಮದೇ ಭಾಷೆಯಲ್ಲಿ ಆಲಿಸುವ ಯಾರೋ ಒಬ್ಬರು.",
      discoveryHeading: "ಸಹಾಯ ಯಾವಾಗಲೂ\nಇಷ್ಟೊಂದು ಹತ್ತಿರವಿತ್ತು.",
      discoveryBody: "ರಾಹಿ ಆಲಿಸುತ್ತದೆ, ಅರ್ಥಮಾಡಿಕೊಳ್ಳುತ್ತದೆ ಮತ್ತು ನಿಮ್ಮ ಜೀವನಕ್ಕೆ ಸರಿಹೊಂದುವ ತರಬೇತಿಯನ್ನು ಹುಡುಕುತ್ತದೆ."
    },
    loading: { preparing: "ನಿಮ್ಮ ಮಾರ್ಗವನ್ನು ಸಿದ್ಧಪಡಿಸಲಾಗುತ್ತಿದೆ..." },
    cta: { callTollFree: "ರಾಹಿಗೆ ಉಚಿತವಾಗಿ ಕರೆ ಮಾಡಿ" },
    call: {
      ringing: "ರಿಂಗ್ ಆಗುತ್ತಿದೆ...", connected: "ಸಂಪರ್ಕಗೊಂಡಿದೆ", greeting1: "ನಮಸ್ಕಾರ! ನಾನು ರಾಹಿ.", greeting2: "ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?",
      connecting: "ಸಂಪರ್ಕಿಸಲಾಗುತ್ತಿದೆ", callEnded: "ಕರೆ ಮುಕ್ತಾಯಗೊಂಡಿದೆ", livelihoodCounselor: "ಜೀವನೋಪಾಯ ಸಲಹೆಗಾರ",
      profilePrepared: "ಜೀವನೋಪಾಯ ಪ್ರೊಫೈಲ್ ಸಿದ್ಧವಾಗಿದೆ.", returnHome: "ಮುಖಪುಟಕ್ಕೆ ಹಿಂತಿರುಗಿ", matchFound: "NSQF ಹೊಂದಾಣಿಕೆ ಕಂಡುಬಂದಿದೆ", confidence: "{score}% ವಿಶ್ವಾಸ", center: "PMKK ನಳಂದ (4.2 ಕಿ.ಮೀ)",
      nextBatch: "ಅಕ್ಟೋಬರ್ 12", sentWhatsapp: "WhatsApp ಮೂಲಕ ಜೀವನೋಪಾಯ ಪ್ಯಾಕ್ ಕಳುಹಿಸಲಾಗಿದೆ", qDistrict: "ನೀವು ಯಾವ ಜಿಲ್ಲೆಯಿಂದ ಮಾತನಾಡುತ್ತಿದ್ದೀರಿ?",
      aDistrict: "ನಳಂದದಿಂದ.", qPreference: "ನೀವು ಕೃಷಿಯ ಹೊರತಾಗಿ ಬೇರೆ ಯಾವುದಾದರೂ ಕೆಲಸ ಮಾಡಲು ಬಯಸುತ್ತೀರಾ?", aPreference: "ಹೌದು, ನಾನು ಮೊಬೈಲ್ ರಿಪೇರಿ ಕಲಿಯಲು ಬಯಸುತ್ತೇನೆ.",
      jobRole: "ಸ್ಮಾರ್ಟ್‌ಫೋನ್ ರಿಪೇರಿ ತಂತ್ರಜ್ಞ"
    },
    direction: "ltr"
  },
  ml: {
    nav: { about: "രാഹിയെക്കുറിച്ച്", help: "രാഹി എങ്ങനെ സഹായിക്കുന്നു", stories: "വിജയഗാഥകൾ" },
    hero: {
      roadHeading: "ഫോമുകളില്ല.\nആപ്പുകളില്ല.\nവായിക്കേണ്ട ആവശ്യമില്ല.",
      roadBody: "ഒരു റോഡ്, ഒരു ഫോൺ നമ്പർ, പിന്നെ നിങ്ങളുടെ സ്വന്തം ഭാഷയിൽ കേൾക്കുന്ന ഒരാൾ മാത്രം.",
      discoveryHeading: "സഹായം എപ്പോഴും\nഇത്ര അടുത്തായിരുന്നു.",
      discoveryBody: "രാഹി കേൾക്കുകയും മനസ്സിലാക്കുകയും നിങ്ങളുടെ ജീവിതത്തിന് അനുയോജ്യമായ പരിശീലനം കണ്ടെത്തുകയും ചെയ്യുന്നു."
    },
    loading: { preparing: "നിങ്ങളുടെ യാത്ര തയ്യാറാകുന്നു..." },
    cta: { callTollFree: "രാഹിയെ സൗജന്യമായി വിളിക്കുക" },
    call: {
      ringing: "റിംഗ് ചെയ്യുന്നു...", connected: "കണക്റ്റുചെയ്‌തു", greeting1: "നമസ്കാരം! ഞാൻ രാഹി.", greeting2: "ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കാം?",
      connecting: "കണക്റ്റുചെയ്യുന്നു", callEnded: "കോൾ അവസാനിച്ചു", livelihoodCounselor: "ഉപജീവന കൗൺസിലർ",
      profilePrepared: "ഉപജീവന പ്രൊഫൈൽ തയ്യാറാണ്.", returnHome: "ഹോംപേജിലേക്ക് മടങ്ങുക", matchFound: "NSQF പൊരുത്തം കണ്ടെത്തി", confidence: "{score}% ആത്മവിശ്വാസം", center: "PMKK നളന്ദ (4.2 കി.മീ)",
      nextBatch: "ഒക്ടോബർ 12", sentWhatsapp: "WhatsApp വഴി ഉപജീവന പാക്ക് അയച്ചു", qDistrict: "നിങ്ങൾ ഏത് ജില്ലയിൽ നിന്നാണ് സംസാരിക്കുന്നത്?",
      aDistrict: "നളന്ദയിൽ നിന്ന്.", qPreference: "കൃഷിക്ക് പുറമെ മറ്റെന്തെങ്കിലും ജോലി ചെയ്യാൻ നിങ്ങൾ ആഗ്രഹിക്കുന്നുണ്ടോ?", aPreference: "അതെ, എനിക്ക് മൊബൈൽ റിപ്പയറിംഗ് പഠിക്കണം.",
      jobRole: "സ്മാർട്ട്‌ഫോൺ റിപ്പയർ ടെക്നീഷ്യൻ"
    },
    direction: "ltr"
  },
  mr: {
    nav: { about: "राही बद्दल", help: "राही कशी मदत करते", stories: "यशोगाथा" },
    hero: {
      roadHeading: "कोणतेही फॉर्म नाहीत.\nकोणतेही ॲप नाहीत.\nवाचण्याची गरज नाही.",
      roadBody: "फक्त एक रस्ता, एक फोन नंबर, आणि कोणीतरी जे तुमच्या स्वतःच्या भाषेत ऐकते.",
      discoveryHeading: "मदत नेहमी\nइतकी जवळ होती.",
      discoveryBody: "राही ऐकते, समजते आणि तुमच्या जीवनाला अनुकूल असे प्रशिक्षण शोधून काढते."
    },
    loading: { preparing: "तुमचा मार्ग तयार होत आहे..." },
    cta: { callTollFree: "राहीला टोल-फ्री कॉल करा" },
    call: {
      ringing: "रिंग होत आहे...", connected: "जोडले", greeting1: "नमस्ते! मी राही आहे.", greeting2: "मी तुमची कशी मदत करू शकते?",
      connecting: "जोडत आहे", callEnded: "कॉल समाप्त", livelihoodCounselor: "उपजीविका सल्लागार",
      profilePrepared: "उपजीविका प्रोफाईल तयार आहे.", returnHome: "मुख्य पानावर परत जा", matchFound: "NSQF जुळणी सापडली", confidence: "{score}% खात्री", center: "PMKK नालंदा (4.2 किमी)",
      nextBatch: "12 ऑक्टोबर", sentWhatsapp: "WhatsApp द्वारे उपजीविका पॅक पाठवला", qDistrict: "तुम्ही कोणत्या जिल्ह्यातून बोलत आहात?",
      aDistrict: "नालंदामधून.", qPreference: "तुम्हाला शेतीव्यतिरिक्त इतर कोणते काम करायला आवडेल का?", aPreference: "होय, मला मोबाईल रिपेअरिंग शिकायचे आहे.",
      jobRole: "स्मार्टफोन रिपेअर टेक्निशियन"
    },
    direction: "ltr"
  },
  or: {
    nav: { about: "ରାହୀ ବିଷୟରେ", help: "ରାହୀ କିପରି ସାହାଯ୍ୟ କରେ", stories: "ସଫଳତା କାହାଣୀ" },
    hero: {
      roadHeading: "କୌଣସି ଫର୍ମ ନାହିଁ।\nକୌଣସି ଆପ୍ ନାହିଁ।\nପଢିବା ଦରକାର ନାହିଁ।",
      roadBody: "କେବଳ ଗୋଟିଏ ରାସ୍ତା, ଗୋଟିଏ ଫୋନ୍ ନମ୍ବର, ଏବଂ ଏପରି କେହି ଯିଏ ଆପଣଙ୍କ ନିଜ ଭାଷାରେ ଶୁଣନ୍ତି।",
      discoveryHeading: "ସାହାଯ୍ୟ ସବୁବେଳେ\nଏତେ ପାଖରେ ଥିଲା।",
      discoveryBody: "ରାହୀ ଶୁଣେ, ବୁଝେ, ଏବଂ ଆପଣଙ୍କ ଜୀବନ ସହିତ ଖାପ ଖାଉଥିବା ତାଲିମ ଖୋଜି ବାହାର କରେ।"
    },
    loading: { preparing: "ଆପଣଙ୍କ ରାସ୍ତା ପ୍ରସ୍ତୁତ ହେଉଛି..." },
    cta: { callTollFree: "ରାହୀକୁ ଟୋଲ୍-ଫ୍ରି କଲ୍ କରନ୍ତୁ" },
    call: {
      ringing: "ରିଙ୍ଗ ହେଉଛି...", connected: "ସଂଯୁକ୍ତ", greeting1: "ନମସ୍କାର! ମୁଁ ରାହୀ।", greeting2: "ମୁଁ ଆପଣଙ୍କୁ କିପରି ସାହାଯ୍ୟ କରିପାରିବି?",
      connecting: "ସଂଯୁକ୍ତ ହେଉଛି", callEnded: "କଲ୍ ଶେଷ", livelihoodCounselor: "ଜୀବିକା ପରାମର୍ଶଦାତା",
      profilePrepared: "ଜୀବିକା ପ୍ରୋଫାଇଲ୍ ପ୍ରସ୍ତୁତ ଅଛି।", returnHome: "ହୋମ୍ ପେଜ୍ କୁ ଫେରନ୍ତୁ", matchFound: "NSQF ମ୍ୟାଚ୍ ମିଳିଲା", confidence: "{score}% କନଫିଡେନ୍ସ", center: "PMKK ନାଳନ୍ଦା (4.2 କିମି)",
      nextBatch: "12 ଅକ୍ଟୋବର", sentWhatsapp: "WhatsApp ମାଧ୍ୟମରେ ଜୀବିକା ପ୍ୟାକ୍ ପଠାଗଲା", qDistrict: "ଆପଣ କେଉଁ ଜିଲ୍ଲାରୁ କଥା କହୁଛନ୍ତି?",
      aDistrict: "ନାଳନ୍ଦାରୁ।", qPreference: "ଆପଣ ଚାଷ ଛଡା ଅନ୍ୟ କୌଣସି କାମ କରିବାକୁ ଚାହିଁବେ କି?", aPreference: "ହଁ, ମୁଁ ମୋବାଇଲ୍ ମରାମତି ଶିଖିବାକୁ ଚାହୁଁଛି।",
      jobRole: "ସ୍ମାର୍ଟଫୋନ୍ ମରାମତି ଟେକ୍ନିସିଆନ୍"
    },
    direction: "ltr"
  },
  pa: {
    nav: { about: "ਰਾਹੀ ਬਾਰੇ", help: "ਰਾਹੀ ਕਿਵੇਂ ਮਦਦ ਕਰਦਾ ਹੈ", stories: "ਸਫਲਤਾ ਦੀਆਂ ਕਹਾਣੀਆਂ" },
    hero: {
      roadHeading: "ਕੋਈ ਫਾਰਮ ਨਹੀਂ।\nਕੋਈ ਐਪ ਨਹੀਂ।\nਪੜ੍ਹਨ ਦੀ ਲੋੜ ਨਹੀਂ।",
      roadBody: "ਸਿਰਫ਼ ਇੱਕ ਰਸਤਾ, ਇੱਕ ਫ਼ੋਨ ਨੰਬਰ, ਅਤੇ ਕੋਈ ਅਜਿਹਾ ਜੋ ਤੁਹਾਡੀ ਆਪਣੀ ਭਾਸ਼ਾ ਵਿੱਚ ਸੁਣਦਾ ਹੈ।",
      discoveryHeading: "ਮਦਦ ਹਮੇਸ਼ਾ\nਐਨੀ ਨੇੜੇ ਸੀ।",
      discoveryBody: "ਰਾਹੀ ਸੁਣਦਾ ਹੈ, ਸਮਝਦਾ ਹੈ, ਅਤੇ ਅਜਿਹੀ ਸਿਖਲਾਈ ਲੱਭਦਾ ਹੈ ਜੋ ਤੁਹਾਡੇ ਜੀਵਨ ਦੇ ਅਨੁਕੂਲ ਹੋਵੇ।"
    },
    loading: { preparing: "ਤੁਹਾਡਾ ਸਫ਼ਰ ਤਿਆਰ ਹੋ ਰਿਹਾ ਹੈ..." },
    cta: { callTollFree: "ਰਾਹੀ ਨੂੰ ਮੁਫ਼ਤ ਕਾਲ ਕਰੋ" },
    call: {
      ringing: "ਰਿੰਗ ਹੋ ਰਿਹਾ ਹੈ...", connected: "ਜੁੜ ਗਿਆ", greeting1: "ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ! ਮੈਂ ਰਾਹੀ ਹਾਂ।", greeting2: "ਮੈਂ ਤੁਹਾਡੀ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦੀ ਹਾਂ?",
      connecting: "ਜੋੜ ਰਿਹਾ ਹੈ", callEnded: "ਕਾਲ ਸਮਾਪਤ", livelihoodCounselor: "ਰੋਜ਼ੀ-ਰੋਟੀ ਸਲਾਹਕਾਰ",
      profilePrepared: "ਰੋਜ਼ੀ-ਰੋਟੀ ਪ੍ਰੋਫਾਈਲ ਤਿਆਰ ਹੈ।", returnHome: "ਹੋਮਪੇਜ 'ਤੇ ਵਾਪਸ ਜਾਓ", matchFound: "NSQF ਮੈਚ ਮਿਲਿਆ", confidence: "{score}% ਭਰੋਸਾ", center: "PMKK ਨਾਲੰਦਾ (4.2 ਕਿ.ਮੀ)",
      nextBatch: "12 ਅਕਤੂਬਰ", sentWhatsapp: "WhatsApp ਰਾਹੀਂ ਰੋਜ਼ੀ-ਰੋਟੀ ਪੈਕ ਭੇਜਿਆ ਗਿਆ", qDistrict: "ਤੁਸੀਂ ਕਿਹੜੇ ਜ਼ਿਲ੍ਹੇ ਤੋਂ ਗੱਲ ਕਰ ਰਹੇ ਹੋ?",
      aDistrict: "ਨਾਲੰਦਾ ਤੋਂ।", qPreference: "ਕੀ ਤੁਸੀਂ ਖੇਤੀ ਤੋਂ ਇਲਾਵਾ ਕੋਈ ਹੋਰ ਕੰਮ ਕਰਨਾ ਚਾਹੋਗੇ?", aPreference: "ਹਾਂ, ਮੈਂ ਮੋਬਾਈਲ ਰਿਪੇਅਰਿੰਗ ਸਿੱਖਣਾ ਚਾਹੁੰਦਾ ਹਾਂ।",
      jobRole: "ਸਮਾਰਟਫੋਨ ਰਿਪੇਅਰ ਟੈਕਨੀਸ਼ੀਅਨ"
    },
    direction: "ltr"
  },
  ta: {
    nav: { about: "ராஹி பற்றி", help: "ராஹி எப்படி உதவுகிறது", stories: "வெற்றிக் கதைகள்" },
    hero: {
      roadHeading: "படிவங்கள் இல்லை.\nசெயலிகள் இல்லை.\nபடிக்கத் தேவையில்லை.",
      roadBody: "ஒரு வழி, ஒரு தொலைபேசி எண், உங்கள் மொழியில் செவிசாய்க்கும் ஒருவர்.",
      discoveryHeading: "உதவி எப்போதும்\nஇவ்வளவு அருகில் இருந்தது.",
      discoveryBody: "ராஹி கேட்கிறது, புரிந்து கொள்கிறது, உங்கள் வாழ்க்கைக்கு ஏற்ற பயிற்சியைக் கண்டறிகிறது."
    },
    loading: { preparing: "உங்கள் பயணம் தயாராகிறது..." },
    cta: { callTollFree: "ராஹியை இலவசமாக அழைக்கவும்" },
    call: {
      ringing: "அழைக்கிறது...", connected: "இணைக்கப்பட்டது", greeting1: "வணக்கம்! நான் ராஹி.", greeting2: "நான் உங்களுக்கு எப்படி உதவ முடியும்?",
      connecting: "இணைகிறது", callEnded: "அழைப்பு முடிந்தது", livelihoodCounselor: "வாழ்வாதார ஆலோசகர்",
      profilePrepared: "வாழ்வாதார சுயவிவரம் தயாராக உள்ளது.", returnHome: "முகப்புப்பக்கத்திற்குத் திரும்பு", matchFound: "NSQF பொருத்தம் கிடைத்தது", confidence: "{score}% நம்பிக்கை", center: "PMKK நாலந்தா (4.2 கி.மீ)",
      nextBatch: "அக்டோபர் 12", sentWhatsapp: "WhatsApp மூலம் வாழ்வாதாரத் தொகுப்பு அனுப்பப்பட்டது", qDistrict: "நீங்கள் எந்த மாவட்டத்திலிருந்து பேசுகிறீர்கள்?",
      aDistrict: "நாலந்தாவிலிருந்து.", qPreference: "விவசாயம் தவிர வேறு ஏதாவது வேலை செய்ய விரும்புகிறீர்களா?", aPreference: "ஆம், நான் மொபைல் பழுதுபார்க்க கற்றுக்கொள்ள விரும்புகிறேன்.",
      jobRole: "ஸ்மார்ட்போன் பழுதுபார்க்கும் தொழில்நுட்புநர்"
    },
    direction: "ltr"
  },
  te: {
    nav: { about: "రాహీ గురించి", help: "రాహీ ఎలా సహాయపడుతుంది", stories: "విజయ గాథలు" },
    hero: {
      roadHeading: "ఫారమ్‌లు లేవు.\nయాప్‌లు లేవు.\nచదవాల్సిన అవసరం లేదు.",
      roadBody: "కేవలం ఒక దారి, ఒక ఫోన్ నంబర్, మీ భాషలో వినే ఒక వ్యక్తి.",
      discoveryHeading: "సహాయం ఎప్పుడూ\nఇంత దగ్గరలో ఉంది.",
      discoveryBody: "రాహీ వింటుంది, అర్థం చేసుకుంటుంది, మీ జీవితానికి సరిపోయే శిక్షణను కనుగొంటుంది."
    },
    loading: { preparing: "మీ ప్రయాణం సిద్ధమవుతోంది..." },
    cta: { callTollFree: "రాహీకి ఉచితంగా కాల్ చేయండి" },
    call: {
      ringing: "రింగ్ అవుతోంది...", connected: "కనెక్ట్ అయింది", greeting1: "నమస్కారం! నేను రాహీ.", greeting2: "నేను మీకు ఎలా సహాయపడగలను?",
      connecting: "కనెక్ట్ అవుతోంది", callEnded: "కాల్ ముగిసింది", livelihoodCounselor: "జీవనోపాధి సలహాదారు",
      profilePrepared: "జీవనోపాధి ప్రొఫైల్ సిద్ధంగా ఉంది.", returnHome: "హోమ్‌పేజీకి తిరిగి వెళ్లండి", matchFound: "NSQF మ్యాచ్ దొరికింది", confidence: "{score}% నమ్మకం", center: "PMKK నలంద (4.2 కి.మీ)",
      nextBatch: "అక్టోబర్ 12", sentWhatsapp: "WhatsApp ద్వారా జీవనోపాధి ప్యాక్ పంపబడింది", qDistrict: "మీరు ఏ జిల్లా నుంచి మాట్లాడుతున్నారు?",
      aDistrict: "నలంద నుండి.", qPreference: "మీరు వ్యవసాయం కాకుండా వేరే పని చేయాలనుకుంటున్నారా?", aPreference: "అవును, నేను మొబైల్ రిపేరింగ్ నేర్చుకోవాలనుకుంటున్నాను.",
      jobRole: "స్మార్ట్‌ఫోన్ రిపేర్ టెక్నీషియన్"
    },
    direction: "ltr"
  },
};
