"""End-to-end voice endpoint: audio in → Sarvam STT → session/turn
(Sarvam-105B extractor + ranker) → Sarvam TTS → audio out.

POST /voice/converse
  form-data:
    audio: WAV/OGG/MP3 file  (optional if `text` given for dev)
    text:  string             (optional; bypasses STT)
    phone: caller phone        (required)
    language: hi|bn|ta|mr|... (default hi)

Returns JSON:
  transcript, reply_text, reply_audio_url, done, top3, composer_text
"""
from __future__ import annotations
import base64
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from ..services import stt, tts
from ..services.stt import _sarvam_lang  # reuse
from ..models.session import TurnIn
from .session import turn as session_turn
from ..db import q as _q

router = APIRouter(prefix="/voice", tags=["voice"])


@router.post("/converse")
async def converse(
    phone: str = Form(...),
    language: str = Form("hi"),
    text: str | None = Form(None),
    audio: UploadFile | None = File(None),
):
    transcript = text or ""
    if audio is not None and not text:
        audio_bytes = await audio.read()
        r = await stt.transcribe(audio_bytes=audio_bytes, audio_url=None, language=language)
        transcript = r.get("text", "")

    inp = TurnIn(phone=phone, transport="ivr", language=language, text=transcript)
    out = await session_turn(inp)

    reply_text = out.composer_text or out.next_question or ""
    reply_audio_url = None
    if reply_text:
        path_or_url = await tts.synthesise(reply_text, language)
        # tts returns file:///tmp/raahi-tts/xxxx.wav — expose it via /tts/{file}
        if path_or_url.startswith("file://"):
            fname = path_or_url.rsplit("/", 1)[-1]
            reply_audio_url = f"/tts/{fname}"
        else:
            reply_audio_url = path_or_url

    # Pull the freshest beneficiary row so the UI can show a live profile card.
    profile = None
    try:
        rows = _q("select name, home_district, age, education_class, education_note, aspiration, "
                  "interests, mobility_km, has_smartphone, self_employ_ok, "
                  "social_category, language from beneficiaries where id=%s::uuid",
                  (out.beneficiary_id,))
        if rows:
            profile = dict(rows[0])
    except Exception:
        pass

    return {
        "transcript": transcript,
        "reply_text": reply_text,
        "reply_audio_url": reply_audio_url,
        "done": out.done,
        "finalizing": out.finalizing,   # true = "let me check" said; call again for results
        "top3": out.top3,
        "composer_text": out.composer_text,
        "recommendation_id": out.recommendation_id,
        "session_id": out.session_id,
        "profile": profile,
    }


@router.get("/tts_demo")
async def tts_demo(text: str, language: str = "hi"):
    """Quick GET: synthesise text and return the audio URL."""
    if not text.strip():
        raise HTTPException(400, "text required")
    path = await tts.synthesise(text, language)
    fname = path.rsplit("/", 1)[-1]
    return {"audio_url": f"/tts/{fname}", "cached_path": path}
