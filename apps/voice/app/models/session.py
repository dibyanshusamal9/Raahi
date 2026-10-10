from typing import Any
from pydantic import BaseModel, field_validator


class TurnIn(BaseModel):
    phone_hash: str | None = None      # if provided, resumes session
    phone: str | None = None           # raw phone; will be hashed
    transport: str = "kiosk"           # ivr | whatsapp | kiosk
    language: str = "hi"
    text: str | None = None            # STT text or typed input
    audio_url: str | None = None       # optional: pointer to uploaded audio
    dtmf: str | None = None            # optional digit


class TurnOut(BaseModel):
    session_id: str
    beneficiary_id: str
    done: bool
    finalizing: bool = False           # interview complete; "let me check" said,
                                       # results come on the next (auto) call
    next_question: str | None = None
    top3: list[dict] | None = None
    composer_text: str | None = None
    recommendation_id: str | None = None
    pack_sent: bool = False

    @field_validator("session_id", "beneficiary_id", "recommendation_id", mode="before")
    @classmethod
    def _stringify_uuid(cls, v: Any) -> Any:
        return str(v) if v is not None else v
