"""WhatsApp webhook — Meta Business Cloud API shape."""
from __future__ import annotations
from fastapi import APIRouter, Request
from ..adapters import get_whatsapp
from ..services import stt
from ..models.session import TurnIn
from .session import turn
from ..logging import log

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


@router.get("/webhook")
async def verify(req: Request):
    """Meta verification handshake."""
    params = dict(req.query_params)
    if params.get("hub.mode") == "subscribe":
        return int(params.get("hub.challenge", 0))
    return {"ok": True}


@router.post("/webhook")
async def receive(req: Request):
    payload = await req.json()
    log.info("wa.recv", size=len(str(payload)))
    try:
        entry = payload["entry"][0]["changes"][0]["value"]
        msg = entry["messages"][0]
        from_ = msg["from"]
        lang = "hi"
        text = ""
        if msg.get("type") == "text":
            text = msg["text"]["body"]
        elif msg.get("type") == "audio":
            wa = get_whatsapp()
            data = await wa.fetch_media(msg["audio"]["id"])
            r = await stt.transcribe(audio_bytes=data, audio_url=None, language=lang)
            text = r.get("text", "")
        inp = TurnIn(phone=from_, transport="whatsapp", language=lang, text=text)
        result = await turn(inp)
        # Send the spoken result back as text (voice would be another call to TTS)
        wa = get_whatsapp()
        if result.done and result.composer_text:
            await wa.send_text(from_, result.composer_text)
        elif result.next_question:
            await wa.send_text(from_, result.next_question)
        return {"ok": True}
    except (KeyError, IndexError):
        return {"ok": True, "ignored": True}
