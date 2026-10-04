from __future__ import annotations
from ..logging import log


class MockWhatsApp:
    async def send_text(self, to: str, text: str) -> dict:
        log.info("mock_wa.text", to=to[-4:], preview=text[:120])
        return {"status": "queued"}

    async def send_voice(self, to: str, audio_url: str) -> dict:
        log.info("mock_wa.voice", to=to[-4:], url=audio_url)
        return {"status": "queued"}

    async def send_pack(self, to: str, pack_text: str, centre_location: dict | None) -> dict:
        log.info("mock_wa.pack", to=to[-4:], loc=centre_location, chars=len(pack_text))
        return {"status": "queued"}

    async def fetch_media(self, media_id: str) -> bytes:
        return b""
