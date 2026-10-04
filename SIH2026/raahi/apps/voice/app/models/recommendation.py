from __future__ import annotations
from datetime import date
from pydantic import BaseModel


class RankedPathway(BaseModel):
    rank: int
    qualification_id: str
    qp_code: str
    qualification_name: str
    sector: str
    nsqf_level: int
    duration_hours: int
    centre_id: str | None = None
    centre_name: str | None = None
    centre_address: str | None = None
    next_batch_date: date | None = None
    distance_km: float | None = None
    total_score: float
    score_aspiration: float
    score_demand: float
    score_mobility: float
    score_gap: float
    score_history: float
    hard_filter: str
