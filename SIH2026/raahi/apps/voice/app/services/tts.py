"""Sarvam Bulbul TTS. Returns audio URL (short-lived).

Speech is synthesised sentence by sentence and the clips are joined with a
short silence between them, so the voice pauses where the text has a full
stop instead of running sentences together (bulbul has no pause control).
Each sentence's clip is cached, so the fixed questions are instant after the
first call.
"""
from __future__ import annotations
import asyncio, httpx, base64, hashlib, io, os, re, wave
from ..settings import settings
from ..logging import log


CACHE_DIR = "/tmp/raahi-tts"
os.makedirs(CACHE_DIR, exist_ok=True)


SARVAM_TTS_LIMIT = 450        # keep each request well inside the API's input cap
SAMPLE_RATE = 22050           # one rate for every clip, so they can be joined
_PARALLEL = asyncio.Semaphore(4)   # sentences synthesised at once

# Scripts that end a sentence with "।": Devanagari, Bengali/Assamese, Odia.
_DANDA_SCRIPT = re.compile(r"[ऀ-৿଀-୿]")
_SENTENCE_END = re.compile(r"(?<=[.!?।])\s+")
_LIST_NUMBER = re.compile(r"^(\d+)\.\s+")
_BRAND = re.compile(r"RAAHI(?![A-Za-z])")

# The service's name in each voice's script, so it is said as one word
# ("Raahi") instead of being spelled out R-A-A-H-I.
_SPOKEN_BRAND = {
    "hi": "राही", "mr": "राही", "bn": "রাহী", "or": "ରାହୀ", "od": "ରାହୀ",
    "ta": "ராஹி", "te": "రాహి", "kn": "ರಾಹಿ", "ml": "രാഹി",
    "gu": "રાહી", "pa": "ਰਾਹੀ",
}

def _speech_text(text: str, language: str) -> str:
    """What is shown -> what the voice should say:
      * "RAAHI" -> the word in the caller's script, said as one word;
      * each line becomes a sentence ("1. Tailor" -> "1, Tailor."), so the
        voice pauses between lines instead of running them together;
      * a dash becomes a comma: the voice ignores dashes but pauses at commas."""
    brand = _SPOKEN_BRAND.get((language or "").lower(), "Raahi")
    out = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        line = _BRAND.sub(brand, line)
        line = _LIST_NUMBER.sub(r"\1, ", line)
        line = line.replace(" — ", ", ").replace("—", ", ")
        if line.endswith(":"):              # "...options:" -> a full stop, then the list
            line = line[:-1]
        if line[-1] not in ".!?।,":
            line += "।" if _DANDA_SCRIPT.search(line) else "."
        out.append(line)
    return " ".join(out)


def _sentences(text: str, limit: int = SARVAM_TTS_LIMIT) -> list[str]:
    """Sentences to synthesise one by one (an over-long one is split at a comma)."""
    out: list[str] = []
    for sentence in _SENTENCE_END.split(text):
        sentence = sentence.strip()
        while len(sentence) > limit:
            cut = sentence.rfind(", ", 0, limit)
            cut = cut + 1 if cut > limit // 2 else limit
            out.append(sentence[:cut].strip())
            sentence = sentence[cut:].strip()
        if sentence:
            out.append(sentence)
    return out


def _join_wavs(blobs: list[bytes], pause_s: float) -> bytes:
    """Concatenate WAV clips (same format) with a pause between them.
    If they can't be read as PCM WAV, fall back to the first clip."""
    try:
        params, frames = None, []
        for blob in blobs:
            with wave.open(io.BytesIO(blob)) as w:
                p = (w.getnchannels(), w.getsampwidth(), w.getframerate())
                if params is None:
                    params = p
                if p == params:
                    frames.append(w.readframes(w.getnframes()))
        channels, width, rate = params
        pause = b"\x00" * (int(rate * pause_s) * channels * width)
        out = io.BytesIO()
        with wave.open(out, "wb") as w:
            w.setnchannels(channels)
            w.setsampwidth(width)
            w.setframerate(rate)
            w.writeframes(pause.join(frames))
        return out.getvalue()
    except Exception as e:
        log.warning("tts.join_failed_using_first_clip", err=str(e)[:200])
        return blobs[0]


def _voice_signature() -> str:
    # Part of every cache key: a voice change must not serve old clips.
    return (f"{settings.sarvam_tts_model}:{settings.sarvam_tts_speaker}:"
            f"{settings.sarvam_tts_pace}:{settings.sarvam_tts_pitch}:"
            f"{settings.sarvam_tts_temperature}:{SAMPLE_RATE}")


def _cache_path(prefix: str, language: str, text: str) -> str:
    key = hashlib.sha256(f"{_voice_signature()}:{language}:{text}".encode()).hexdigest()[:16]
    return f"{CACHE_DIR}/{prefix}{key}.wav"


async def synthesise(text: str, language: str) -> str:
    """Return a path (or URL) to a WAV. Never raises — on any provider error
    we return a silent placeholder so the caller can still ship a JSON reply."""
    language = (language or "en").lower()
    text = _speech_text((text or "").strip(), language)
    if not text:
        text = "..."

    path = _cache_path("", language, f"{settings.sarvam_tts_pause_s}:{text}")
    if os.path.exists(path):
        return f"file://{path}"

    def _silent_placeholder() -> str:
        # IMPORTANT: write to a SHARED silent file, never to `path`. Writing the
        # placeholder to the per-phrase cache key would poison that phrase — a
        # single transient failure (no credits, bad speaker) would then be
        # served forever, even after the problem is fixed. Using a separate file
        # means the next call re-hits the API and can succeed.
        silent = f"{CACHE_DIR}/_silent.wav"
        if not os.path.exists(silent):
            with open(silent, "wb") as f:
                f.write(b"RIFF\x00\x00\x00\x00WAVEfmt ")
        return f"file://{silent}"

    if not settings.sarvam_api_key:
        log.info("tts.mock", text=text[:80])
        return _silent_placeholder()

    url = "https://api.sarvam.ai/text-to-speech"
    headers = {"api-subscription-key": settings.sarvam_api_key}
    v3 = settings.sarvam_tts_model.startswith("bulbul:v3")

    async def _sentence_audio(c: httpx.AsyncClient, sentence: str) -> bytes:
        cached = _cache_path("s_", language, sentence)
        if os.path.exists(cached):
            with open(cached, "rb") as f:
                return f.read()
        body = {"inputs": [sentence], "target_language_code": _lang(language),
                "model": settings.sarvam_tts_model,
                "speaker": settings.sarvam_tts_speaker,   # soft female voice
                "pace": settings.sarvam_tts_pace,
                "speech_sample_rate": SAMPLE_RATE}
        if v3:
            body["temperature"] = settings.sarvam_tts_temperature   # expressiveness
        else:
            body["pitch"] = settings.sarvam_tts_pitch               # v1/v2 only
        async with _PARALLEL:
            r = await c.post(url, headers=headers, json=body)
        r.raise_for_status()
        audio = base64.b64decode(r.json()["audios"][0])
        with open(cached, "wb") as f:
            f.write(audio)
        return audio

    try:
        async with httpx.AsyncClient(timeout=30.0) as c:
            blobs = list(await asyncio.gather(*(_sentence_audio(c, s) for s in _sentences(text))))
        audio = blobs[0] if len(blobs) == 1 else _join_wavs(blobs, settings.sarvam_tts_pause_s)
        with open(path, "wb") as f:
            f.write(audio)
        return f"file://{path}"
    except Exception as e:
        log.warning("tts.failed_returning_silent", err=str(e)[:200])
        return _silent_placeholder()


# The languages RAAHI supports: the ones Sarvam can both hear and speak.
_LANG = {"bn": "bn-IN", "en": "en-IN", "gu": "gu-IN", "hi": "hi-IN", "kn": "kn-IN",
         "ml": "ml-IN", "mr": "mr-IN", "or": "od-IN", "od": "od-IN", "pa": "pa-IN",
         "ta": "ta-IN", "te": "te-IN"}


def _lang(code: str) -> str:
    return _LANG.get(code, "en-IN")
