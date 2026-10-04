"""Strict beneficiary patch schema — the extractor may propose only fields
that validate here. A failing patch triggers a re-prompt, not a silent write
(FR-03 acceptance test)."""
from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, Field, field_validator


SocialCategory = Literal["SC", "ST", "OBC", "GEN"]
IncomeBracket = Literal["under_1L", "1L_3L", "3L_5L", "over_5L"]
Gender = Literal["F", "M", "O"]


class BeneficiaryPatch(BaseModel):
    """A partial update to beneficiary fields. Every field is optional;
    the extractor emits only what it heard confidently in this turn."""

    model_config = {"extra": "forbid"}     # forbid ⇒ fabrications fail loudly

    language: str | None = None
    name: str | None = None
    home_district: str | None = None
    home_state: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    age: int | None = Field(default=None, ge=10, le=90)
    gender: Gender | None = None
    social_category: SocialCategory | None = None
    income_bracket: IncomeBracket | None = None
    education_class: int | None = Field(default=None, ge=0, le=17)
    education_note: str | None = None
    literacy: str | None = None
    has_smartphone: bool | None = None
    interests: list[str] | None = None
    prior_trade: str | None = None
    aspiration: str | None = None
    mobility_km: int | None = Field(default=None, ge=0, le=1000)
    self_employ_ok: bool | None = None

    @field_validator("interests")
    @classmethod
    def _short_interests(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return None
        return [x.strip()[:60] for x in v if x and x.strip()][:8]


class BeneficiaryProfile(BeneficiaryPatch):
    """Same shape; used as a snapshot for recommendations."""
    id: str | None = None
