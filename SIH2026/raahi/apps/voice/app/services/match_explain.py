"""Per-criterion match explainability (FR-10 support).

The ranker already returns five numeric sub-scores per pathway. On their own
those are opaque to a caller and to an auditor. This turns them into a small set
of named checks — each `confirmed`, `partial`, `unverified` or `fail` with a
plain-English reason — so the composer can say *why* a pathway is suggested and
an officer can see which factors were actually confirmed vs. merely assumed.

Inspired by Yojana-setu's match_schemes() returning confirmedCount /
unverifiedCriteria: rank on what we could confirm, and never present an
unconfirmed factor as if it were confirmed.
"""
from __future__ import annotations

CONFIRMED = "confirmed"
PARTIAL = "partial"
UNVERIFIED = "unverified"
FAIL = "fail"


def _verdict(score: float, strong: float = 0.6, weak: float = 0.35) -> str:
    if score >= strong:
        return CONFIRMED
    if score >= weak:
        return PARTIAL
    return UNVERIFIED


def explain_row(row: dict, ben: dict) -> dict:
    """Return {checks, confirmed_count, match_score} for one ranked pathway.

    `row` is a cleaned ranker row (has score_* fields, distance_km, hard_filter);
    `ben` is the beneficiary record (interests, home_district, education_class,
    mobility_km, self_employ_ok).
    """
    checks: list[dict] = []

    def add(factor: str, verdict: str, detail: str) -> None:
        checks.append({"factor": factor, "verdict": verdict, "detail": detail})

    interests = ben.get("interests") or []
    district = ben.get("home_district")

    # 1. Skill / interest match
    sa = float(row.get("score_aspiration") or 0)
    if not interests:
        add("interest", UNVERIFIED, "no specific interest stated yet")
    else:
        listed = ", ".join(interests[:3])
        add("interest", _verdict(sa),
            f"matches your interest in {listed}" if sa >= 0.35
            else f"only a loose fit to {listed}")

    # 2. Local (district) demand
    sd = float(row.get("score_demand") or 0)
    if sd > 0.02:
        add("local_demand", CONFIRMED if sd >= 0.2 else PARTIAL,
            f"recent hiring demand in {district}" if district
            else "recent hiring demand in your district")
    else:
        add("local_demand", UNVERIFIED,
            f"no recent demand data for {district}" if district
            else "no recent local demand data")

    # 3. Education / NSQF level fit
    sl = float(row.get("score_gap") or 0)
    if ben.get("education_class") is None:
        add("level_fit", UNVERIFIED, "your schooling level isn't known yet")
    else:
        add("level_fit", _verdict(sl, 0.7, 0.4),
            "suits your schooling level" if sl >= 0.7
            else "a stretch from your schooling level")

    # 4. Reachability
    sm = float(row.get("score_mobility") or 0)
    km = row.get("distance_km")
    cdist = row.get("centre_district")
    if km is None and not row.get("centre_name"):
        add("reachability", UNVERIFIED, "no training centre teaches this course yet")
    elif km is None:
        # A centre is known but its exact distance isn't (district-level location).
        if cdist and district and cdist.lower() == district.lower():
            add("reachability", CONFIRMED if sm >= 0.6 else PARTIAL,
                f"training centre in your district ({cdist})")
        else:
            add("reachability", PARTIAL if sm >= 0.6 else UNVERIFIED,
                f"nearest centre is in {cdist}" if cdist
                else "nearest centre is in another district")
    else:
        km_txt = f"~{km:g} km away"
        add("reachability",
            CONFIRMED if sm >= 1.0 else (PARTIAL if sm >= 0.6 else UNVERIFIED),
            f"centre {km_txt}, within your travel range" if sm >= 1.0
            else f"nearest centre {km_txt}")

    # 5. Self-employment alignment
    sh = float(row.get("score_history") or 0)
    if ben.get("self_employ_ok") is None:
        add("work_preference", UNVERIFIED, "own-work vs. job preference not known")
    else:
        add("work_preference", _verdict(sh, 0.8, 0.5),
            "fits whether you want your own work or a job")

    # Hard filter surfaces only when it flagged something
    hf = (row.get("hard_filter") or "").upper()
    if hf == "UNKNOWN":
        add("eligibility", UNVERIFIED, "age not captured, eligibility unconfirmed")
    elif hf and hf not in ("PASS", ""):
        add("eligibility", FAIL, "does not meet the entry criteria")

    confirmed = sum(1 for c in checks if c["verdict"] == CONFIRMED)
    match_score = round(float(row.get("total_score") or 0) * 100)
    return {"checks": checks, "confirmed_count": confirmed, "match_score": match_score}
