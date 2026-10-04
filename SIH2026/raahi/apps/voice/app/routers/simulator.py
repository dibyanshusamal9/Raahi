from __future__ import annotations
from fastapi import APIRouter, UploadFile, File, Form
from pydantic import BaseModel
from .session import turn
from ..models.session import TurnIn
from ..db import q
from ..services import tts, stt

router = APIRouter(prefix="/simulator", tags=["simulator"])

class SimulatorTurnOut(BaseModel):
    session_id: str
    beneficiary_id: str
    done: bool
    finalizing: bool
    next_question: str | None
    top3: list[dict] | None
    composer_text: str | None
    slots: dict[str, str | None]
    audio_url: str | None = None

@router.post("/turn", response_model=SimulatorTurnOut)
async def simulator_turn(inp: TurnIn) -> SimulatorTurnOut:
    # 1. Call the real turn processor
    out = await turn(inp)
    
    # 2. Extract the beneficiary state to populate the UI slots
    b_rows = q("select age, home_district, interests, self_employ_ok from beneficiaries where id=%s::uuid", (out.beneficiary_id,))
    
    slots = {
        "DISTRICT": None,
        "AGE": None,
        "PREFERENCE": None,
        "SKILL INTENT": None
    }
    
    if b_rows:
        b = b_rows[0]
        slots["DISTRICT"] = b.get("home_district")
        slots["AGE"] = str(b.get("age")) if b.get("age") is not None else None
        
        interests = b.get("interests")
        if interests and len(interests) > 0:
            slots["SKILL INTENT"] = ", ".join(interests).title()
            
        if b.get("self_employ_ok") is True:
            slots["PREFERENCE"] = "Self-Employment"
        elif b.get("self_employ_ok") is False:
            slots["PREFERENCE"] = "Salaried Job"
            
    # 3. Generate TTS audio
    text_to_speak = out.composer_text or out.next_question
    audio_url = None
    if text_to_speak:
        try:
            path_or_url = await tts.synthesise(text_to_speak, inp.language)
            if path_or_url and path_or_url.startswith("file://"):
                fname = path_or_url.split("/")[-1]
                audio_url = f"/tts/{fname}"
        except Exception as e:
            pass # fallback to no audio if TTS fails
            
    return SimulatorTurnOut(
        session_id=out.session_id,
        beneficiary_id=out.beneficiary_id,
        done=out.done,
        finalizing=out.finalizing,
        next_question=out.next_question,
        top3=out.top3,
        composer_text=out.composer_text,
        slots=slots,
        audio_url=audio_url
    )


@router.post("/stt")
async def simulator_stt(audio: UploadFile = File(...), language: str = Form("hi")) -> dict:
    """Transcribe one spoken answer in the caller's own language and script.

    The call screen records every answer and sends it here (Sarvam STT); the
    browser's built-in recogniser hears many Indian languages as English."""
    data = await audio.read()
    if not data:
        return {"text": "", "provider": "none"}
    result = await stt.transcribe(audio_bytes=data, audio_url=None, language=language)
    return {"text": (result.get("text") or "").strip(), "provider": result.get("provider")}
