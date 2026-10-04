// Only languages Sarvam can both hear and speak (bulbul:v3 voices).
export type LanguageCode =
  | "en" | "hi" | "bn" | "gu" | "kn" | "ml" | "mr" | "or" | "pa" | "ta" | "te";

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
    confidence: string;   // contains "{score}", replaced with the 0-100 match score
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
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം" },
  { code: "mr", name: "Marathi", nativeName: "मराठी" },
  { code: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ" },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు" }
];
