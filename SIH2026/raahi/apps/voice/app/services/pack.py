"""FR-07 · Livelihood pack delivery.

After the interview, the beneficiary receives an SMS + WhatsApp message
with the chosen qualification, centre name+address, next batch date,
documents to bring, and (if self-employment) the linked scheme."""
from __future__ import annotations
from datetime import date
from ..adapters import get_whatsapp
from ..db import q
from ..logging import log


def render_pack(top: dict, language: str = "hi") -> str:
    docs = q(
        """
        select documents_required from centre_qualifications
        where centre_id=%s::uuid and qualification_id=%s::uuid
        """,
        (top["centre_id"], top["qualification_id"]),
    )
    doc_list = docs[0]["documents_required"] if docs else ["Aadhaar", "Photo"]
    scheme_line = _scheme_line(top)

    if language == "hi":
        return (
            f"आपके लिए सुझाव: {top['qualification_name']} ({top['sector']}, स्तर {top['nsqf_level']})।\n"
            f"केंद्र: {top.get('centre_name')}\n"
            f"पता: {top.get('centre_address')}\n"
            f"अगला बैच: {top.get('next_batch_date')}\n"
            f"साथ लाएँ: {', '.join(doc_list)}\n"
            f"{scheme_line}"
        )
    # English fallback
    return (
        f"Recommendation: {top['qualification_name']} ({top['sector']}, L{top['nsqf_level']}).\n"
        f"Centre: {top.get('centre_name')}\n"
        f"Address: {top.get('centre_address')}\n"
        f"Next batch: {top.get('next_batch_date')}\n"
        f"Bring: {', '.join(doc_list)}\n"
        f"{scheme_line}"
    )


def _scheme_line(top: dict) -> str:
    if top.get("sector", "").lower() in ("handloom", "agriculture", "food processing"):
        row = q("select code, name, source_url from schemes where code='PM-VISHWAKARMA'")
        if row:
            return f"योजना: {row[0]['name']} — {row[0]['source_url']}"
    return ""


async def send_pack(phone: str, top: dict, language: str) -> bool:
    wa = get_whatsapp()
    text = render_pack(top, language)
    loc = None
    # If we had lat/lng on the centre we'd pass it; the demo tables carry it
    # but not on the ranker output — fetch:
    if top.get("centre_id"):
        row = q("select latitude, longitude, name, address from training_centres where id=%s::uuid",
                (top["centre_id"],))
        if row:
            r = row[0]
            loc = {"latitude": r["latitude"], "longitude": r["longitude"],
                   "name": r["name"], "address": r["address"]}
    try:
        await wa.send_pack(phone, text, loc)
        log.info("pack.sent", to=phone[-4:])
        return True
    except Exception as e:
        log.warning("pack.send_failed", err=str(e))
        return False
