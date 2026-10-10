"""Twilio IVR adapter.
Implements IVRProvider using Twilio Voice REST API and TwiML webhook conventions.
"""
from __future__ import annotations
import httpx
from ..settings import settings
from ..logging import log


class TwilioIVR:
    def __init__(self) -> None:
        self.account_sid = settings.twilio_account_sid
        self.auth_token = settings.twilio_auth_token
        self.phone_number = settings.twilio_phone_number
        self.base = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}"

    def _auth(self) -> tuple[str, str]:
        assert self.account_sid and self.auth_token, "Twilio credentials missing (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)"
        return (self.account_sid, self.auth_token)

    async def answer_and_prompt(self, call_id: str, prompt_text: str, language: str) -> dict:
        log.info("twilio.answer", call_id=call_id, lang=language)
        return {"status": "answered"}

    async def play_and_record(self, call_id: str, prompt_text: str, language: str,
                              max_seconds: int = 8) -> dict:
        log.info("twilio.record", call_id=call_id)
        # Twilio manages recording via TwiML <Record> action webhook
        return {"status": "recording_prompted"}

    async def dtmf_menu(self, call_id: str, prompt_text: str, digits: int = 1) -> dict:
        log.info("twilio.dtmf_menu", call_id=call_id, digits=digits)
        return {"status": "dtmf_prompted"}

    async def hangup(self, call_id: str, farewell: str, language: str) -> None:
        if not self.account_sid or not self.auth_token:
            return
        url = f"{self.base}/Calls/{call_id}.json"
        async with httpx.AsyncClient(auth=self._auth(), timeout=10.0) as client:
            try:
                await client.post(url, data={"Status": "completed"})
            except Exception as e:
                log.warning("twilio.hangup_failed", err=str(e), call_id=call_id)
