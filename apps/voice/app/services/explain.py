"""FR-10 · Explainability trail. No 'black box' answer is valid during audit."""
from __future__ import annotations
from ..db import q


def trail(recommendation_id: str) -> dict:
    rec = q("select * from recommendations where id=%s::uuid", (recommendation_id,))
    if not rec:
        return {}
    r = rec[0]
    turns = q(
        "select turn_no, asked, heard_text, stt_provider, stt_confidence, extractor_patch, latency_ms "
        "from voice_turns where session_id=%s::uuid order by turn_no",
        (r["session_id"],),
    )
    demand_ids = (r.get("signals_used") or {}).get("demand_row_ids", [])
    demand_rows = []
    if demand_ids:
        demand_rows = q(
            "select id, district, sector, qp_code, role_title, vacancies_90d, "
            "source_url, evidence_date from demand_signals where id = any(%s)",
            (demand_ids,),
        )
    return {
        "recommendation": r,
        "session_turns": turns,
        "demand_evidence": demand_rows,
    }
