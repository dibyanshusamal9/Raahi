const inr = new Intl.NumberFormat("en-IN");

/** 803988 → "8,03,988" */
export const fmt = (n: number) => inr.format(n);

export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", hi: "Hindi", bn: "Bengali", gu: "Gujarati", kn: "Kannada", ml: "Malayalam",
  mr: "Marathi", or: "Odia", od: "Odia", pa: "Punjabi", ta: "Tamil", te: "Telugu",
  // RAAHI no longer offers these, but older calls were made in them
  as: "Assamese", brx: "Bodo", doi: "Dogri", ks: "Kashmiri", gom: "Konkani", mai: "Maithili",
  mni: "Manipuri", ne: "Nepali", sa: "Sanskrit", sat: "Santali", sd: "Sindhi", ur: "Urdu",
  unknown: "Not known",
};

export const languageName = (code?: string | null) =>
  code ? LANGUAGE_NAMES[code] ?? code : "—";

export function fmtDateTime(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
