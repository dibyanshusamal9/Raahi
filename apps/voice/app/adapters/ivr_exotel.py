"""Exotel IVR adapter — thin skeleton. Fill in when SID/token are provided.
Exotel returns XML/ExoML for prompts; play_and_record uses <Record>."""
from __future__ import annotations
import httpx
from ..settings import settings
from ..logging import log


class ExotelIVR:
    def __init__(self) -> None:
        self.sid = settings.exotel_sid
        self.token = settings.exotel_token
        self.base = f"https://api.exotel.com/v1/Accounts/{self.sid}"

    def _auth(self) -> tuple[str, str]:
        assert self.sid and self.token, "Exotel credentials missing"
        return (self.sid, self.token)

    async def answer_and_prompt(self, call_id: str, prompt_text: str, language: str) -> dict:
        # In Exotel, the initial ExoML is served from a public URL you configure
        # on the AppBazaar flow. This method exists so business logic doesn't care.
        log.info("exotel.answer", call_id=call_id, lang=language)
        return {"status": "answered"}

    async def play_and_record(self, call_id: str, prompt_text: str, language: str,
                              max_seconds: int = 8) -> dict:
        # Post to /Calls/{sid}/Passthru or similar; here we outline the call.
        log.info("exotel.record", call_id=call_id)
        return {"status": "recorded", "audio_url": f"https://s3.example/{call_id}.wav"}

    async def dtmf_menu(self, call_id: str, prompt_text: str, digits: int = 1) -> dict:
        return {"status": "dtmf", "digits": "1"}

    async def hangup(self, call_id: str, farewell: str, language: str) -> None:
        async with httpx.AsyncClient(auth=self._auth(), timeout=10.0) as client:
            await client.post(f"{self.base}/Calls/{call_id}.json",
                              data={"Status": "completed"})
