"""IVR webhooks — provider-agnostic. The provider posts audio here; we
transcribe, then hand off to /session/turn's logic."""
from __future__ import annotations
from fastapi import APIRouter, Request, HTTPException
from ..adapters import get_ivr
from ..services import stt
from ..models.session import TurnIn
from .session import turn
from ..db import phone_hash
from ..logging import log

router = APIRouter(prefix="/ivr", tags=["ivr"])


@router.post("/inbound")
async def inbound(req: Request):
    """Provider posts call metadata when a call is answered."""
    payload = await _payload(req)
    call_id = payload.get("CallSid") or payload.get("call_id") or "unknown"
    caller = payload.get("From") or payload.get("caller") or ""
    lang = payload.get("Language") or "hi"
    log.info("ivr.inbound", call_id=call_id, caller=caller[-4:])
    ivr = get_ivr()
    await ivr.answer_and_prompt(call_id, "Namaste, connecting you.", lang)
    return {"ok": True, "call_id": call_id}


@router.post("/turn")
async def ivr_turn(req: Request):
    """Provider posts audio (or a URL to it) + call context."""
    payload = await _payload(req)
    call_id = payload.get("CallSid") or payload.get("call_id")
    caller = payload.get("From") or payload.get("caller")
    lang = payload.get("Language") or "hi"
    audio_url = payload.get("RecordingUrl") or payload.get("audio_url")
    dtmf = payload.get("Digits") or payload.get("dtmf")

    text = ""
    if audio_url:
        # In production, download from provider first; skeleton uses url passthrough.
        r = await stt.transcribe(audio_bytes=None, audio_url=audio_url, language=lang)
        text = r.get("text", "")
    elif dtmf:
        text = _dtmf_to_text(dtmf)

    if not caller:
        raise HTTPException(400, "no caller")

    inp = TurnIn(phone=caller, transport="ivr", language=lang, text=text,
                 audio_url=audio_url, dtmf=dtmf)
    return await turn(inp)


async def _payload(req: Request) -> dict:
    ct = req.headers.get("content-type", "")
    if "application/json" in ct:
        return await req.json()
    form = await req.form()
    return dict(form)


def _dtmf_to_text(digits: str) -> str:
    # Trivial DTMF menu — 1=yes, 2=no. FR-13 (P2) would expand this.
    return {"1": "haan", "2": "nahi"}.get(digits, digits)
