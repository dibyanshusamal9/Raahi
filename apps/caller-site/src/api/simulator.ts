export interface SimulatorResponse {
  session_id: string;
  beneficiary_id: string;
  done: boolean;
  finalizing: boolean;
  next_question: string | null;
  top3: any[] | null;
  composer_text: string | null;
  audio_url: string | null;
  slots: {
    DISTRICT: string | null;
    AGE: string | null;
    PREFERENCE: string | null;
    "SKILL INTENT": string | null;
  };
}

// The backend keys a caller (and their session) on this phone ID, so the same
// ID must be sent on every turn of one call.
export function newCallerId(): string {
  return `sim_${Math.floor(Math.random() * 1000000)}`;
}

export async function sendTurn(
  text: string | null,
  language: string,
  phone: string
): Promise<SimulatorResponse> {
  const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const res = await fetch(`${url}/simulator/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone: phone,
      language: language,
      transport: "kiosk",
      text: text,
    }),
  });

  if (!res.ok) {
    throw new Error("API call failed");
  }
  
  return res.json();
}

export interface Transcript {
  text: string;
  // false when the speech service itself failed (e.g. out of credits),
  // as opposed to the caller saying nothing it could make out
  available: boolean;
}

// Transcribe one recorded answer on the backend (Sarvam), in the caller's own
// language and script. Every spoken answer goes through here.
export async function transcribeAudio(audio: Blob, language: string): Promise<Transcript> {
  const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const form = new FormData();
  form.append("audio", audio, audio.type.includes("ogg") ? "answer.ogg" : "answer.webm");
  form.append("language", language);
  const res = await fetch(`${url}/simulator/stt`, { method: "POST", body: form });
  if (!res.ok) {
    throw new Error("Speech recognition failed");
  }
  const data = await res.json();
  return { text: (data.text || "").trim(), available: data.available !== false };
}
