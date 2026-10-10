from __future__ import annotations
from ..logging import log


class MockIVR:
    async def answer_and_prompt(self, call_id: str, prompt_text: str, language: str) -> dict:
        log.info("mock_ivr.answer", call_id=call_id, lang=language, prompt=prompt_text[:80])
        return {"status": "answered"}

    async def play_and_record(self, call_id: str, prompt_text: str, language: str,
                              max_seconds: int = 8) -> dict:
        log.info("mock_ivr.record", call_id=call_id, prompt=prompt_text[:60])
        return {"status": "recorded", "audio_url": f"mock://audio/{call_id}.wav"}

    async def dtmf_menu(self, call_id: str, prompt_text: str, digits: int = 1) -> dict:
        return {"status": "dtmf", "digits": "1"}

    async def hangup(self, call_id: str, farewell: str, language: str) -> None:
        log.info("mock_ivr.hangup", call_id=call_id, farewell=farewell[:60])
