"""Meta WhatsApp Business Cloud API adapter — skeleton."""
from __future__ import annotations
import httpx
from ..settings import settings


class MetaWhatsApp:
    def __init__(self) -> None:
        self.phone_id = settings.meta_waba_phone_id
        self.token = settings.meta_waba_token
        self.base = "https://graph.facebook.com/v20.0"

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.token}"}

    async def send_text(self, to: str, text: str) -> dict:
        async with httpx.AsyncClient(headers=self._headers(), timeout=10.0) as c:
            r = await c.post(
                f"{self.base}/{self.phone_id}/messages",
                json={"messaging_product": "whatsapp", "to": to,
                      "type": "text", "text": {"body": text[:4096]}},
            )
            r.raise_for_status()
            return r.json()

    async def send_voice(self, to: str, audio_url: str) -> dict:
        async with httpx.AsyncClient(headers=self._headers(), timeout=10.0) as c:
            r = await c.post(
                f"{self.base}/{self.phone_id}/messages",
                json={"messaging_product": "whatsapp", "to": to,
                      "type": "audio", "audio": {"link": audio_url}},
            )
            r.raise_for_status()
            return r.json()

    async def send_pack(self, to: str, pack_text: str, centre_location: dict | None) -> dict:
        results = [await self.send_text(to, pack_text)]
        if centre_location:
            async with httpx.AsyncClient(headers=self._headers(), timeout=10.0) as c:
                r = await c.post(
                    f"{self.base}/{self.phone_id}/messages",
                    json={"messaging_product": "whatsapp", "to": to,
                          "type": "location", "location": centre_location},
                )
                results.append(r.json())
        return {"parts": results}

    async def fetch_media(self, media_id: str) -> bytes:
        async with httpx.AsyncClient(headers=self._headers(), timeout=10.0) as c:
            meta = (await c.get(f"{self.base}/{media_id}")).json()
            data = await c.get(meta["url"])
            return data.content
