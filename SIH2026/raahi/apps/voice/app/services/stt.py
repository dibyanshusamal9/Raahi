"""FR-02 · Dialect-tolerant speech recognition.
Primary: Sarvam Saaras. Fallback: Whisper. Third: DTMF."""
from __future__ import annotations
import httpx
from ..settings import settings
from ..logging import log


class STTResult(dict):
    """{'text': str, 'confidence': float, 'provider': str}"""


async def transcribe(audio_bytes: bytes | None, audio_url: str | None,
                     language: str) -> STTResult:
    # If caller supplied text directly (kiosk/dev), pass through.
    if audio_bytes is None and audio_url is None:
        return STTResult(text="", confidence=0.0, provider="none")

    if settings.sarvam_api_key:
        try:
            return await _sarvam_saaras(audio_bytes, audio_url, language)
        except Exception as e:
            log.warning("stt.sarvam_failed", err=str(e))
    # Fallback: whisper via openai
    if settings.openai_api_key and audio_bytes:
        try:
            return await _whisper(audio_bytes, language)
        except Exception as e:
            log.warning("stt.whisper_failed", err=str(e))
    return STTResult(text="", confidence=0.0, provider="none")


async def _sarvam_saaras(audio_bytes: bytes | None, audio_url: str | None,
                         language: str) -> STTResult:
    url = "https://api.sarvam.ai/speech-to-text"
    headers = {"api-subscription-key": settings.sarvam_api_key}
    data = {"language_code": _sarvam_lang(language), "model": settings.sarvam_stt_model}
    async with httpx.AsyncClient(timeout=30.0) as c:
        if audio_bytes:
            # sniff format for a sensible filename + content-type
            head = audio_bytes[:16]
            if head.startswith(b"OggS"):
                fname, ctype = "audio.ogg", "audio/ogg"
            elif head.startswith(b"\x1aE\xdf\xa3"):
                fname, ctype = "audio.webm", "audio/webm"
            elif head[:4] == b"RIFF":
                fname, ctype = "audio.wav", "audio/wav"
            elif head[:3] == b"ID3" or head[:2] in (b"\xff\xfb", b"\xff\xf3"):
                fname, ctype = "audio.mp3", "audio/mpeg"
            else:
                fname, ctype = "audio.wav", "audio/wav"
            files = {"file": (fname, audio_bytes, ctype)}
            r = await c.post(url, headers=headers, data=data, files=files)
        else:
            data["audio_url"] = audio_url
            r = await c.post(url, headers=headers, json=data)
        r.raise_for_status()
        j = r.json()
        return STTResult(text=j.get("transcript", ""),
                         confidence=float(j.get("confidence", 0.7)),
                         provider="sarvam")


async def _whisper(audio_bytes: bytes, language: str) -> STTResult:
    url = "https://api.openai.com/v1/audio/transcriptions"
    headers = {"Authorization": f"Bearer {settings.openai_api_key}"}
    files = {"file": ("audio.wav", audio_bytes, "audio/wav")}
    data = {"model": "whisper-1", "language": language[:2]}
    async with httpx.AsyncClient(timeout=30.0) as c:
        r = await c.post(url, headers=headers, data=data, files=files)
        r.raise_for_status()
        return STTResult(text=r.json().get("text", ""), confidence=0.6, provider="whisper")


_SARVAM_LANG = {"bn": "bn-IN", "en": "en-IN", "gu": "gu-IN", "hi": "hi-IN", "kn": "kn-IN",
                "ml": "ml-IN", "mr": "mr-IN", "or": "od-IN", "od": "od-IN", "pa": "pa-IN",
                "ta": "ta-IN", "te": "te-IN"}


def _sarvam_lang(code: str) -> str:
    return _SARVAM_LANG.get(code, "en-IN")
