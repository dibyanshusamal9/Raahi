export type LanguageCode =
  | "en" | "hi" | "as" | "bn" | "brx" | "doi" | "gu" | "kn" | "ks"
  | "gom" | "mai" | "ml" | "mni" | "mr" | "ne" | "or" | "pa"
  | "sa" | "sat" | "sd" | "ta" | "te" | "ur";

export interface TranslationData {
  nav: {
    about: string;
    help: string;
    stories: string;
  };
  hero: {
    roadHeading: string;
    roadBody: string;
    discoveryHeading: string;
    discoveryBody: string;
  };
  loading: {
    preparing: string;
  };
  cta: {
    callTollFree: string;
  };
  call: {
    ringing: string;
    connected: string;
    greeting1: string;
    greeting2: string;
    connecting: string;
    callEnded: string;
    livelihoodCounselor: string;
    profilePrepared: string;
    returnHome: string;
    matchFound: string;
    confidence: string;
    center: string;
    nextBatch: string;
    sentWhatsapp: string;
    qDistrict: string;
    aDistrict: string;
    qPreference: string;
    aPreference: string;
    jobRole: string;
  };
  direction: "ltr" | "rtl";
}

export const LANGUAGES: { code: LanguageCode; name: string; nativeName: string }[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "as", name: "Assamese", nativeName: "অসমীয়া" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
  { code: "brx", name: "Bodo", nativeName: "बड़ो" },
  { code: "doi", name: "Dogri", nativeName: "डोगरी" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "ks", name: "Kashmiri", nativeName: "कॉशुर / کٲشُر" },
  { code: "gom", name: "Konkani", nativeName: "कोंकणी" },
  { code: "mai", name: "Maithili", nativeName: "मैथिली" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം" },
  { code: "mni", name: "Manipuri", nativeName: "ꯃꯤꯇꯩꯂꯣꯟ" },
  { code: "mr", name: "Marathi", nativeName: "मराठी" },
  { code: "ne", name: "Nepali", nativeName: "नेपाली" },
  { code: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ" },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
  { code: "sa", name: "Sanskrit", nativeName: "संस्कृतम्" },
  { code: "sat", name: "Santali", nativeName: "ᱥᱟᱱᱛᱟᱲᱤ" },
  { code: "sd", name: "Sindhi", nativeName: "सिन्धी / سنڌي" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు" },
  { code: "ur", name: "Urdu", nativeName: "اردو" }
];
