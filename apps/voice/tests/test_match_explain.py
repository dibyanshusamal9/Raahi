"""Per-criterion match explainability."""
from app.services.match_explain import (
    explain_row, CONFIRMED, PARTIAL, UNVERIFIED, FAIL,
)


def _verdict(out, factor):
    return next(c["verdict"] for c in out["checks"] if c["factor"] == factor)


def test_strong_match_confirms_factors():
    row = {"score_aspiration": 0.8, "score_demand": 0.5, "score_gap": 0.9,
           "score_mobility": 1.0, "score_history": 0.9, "distance_km": 6,
           "total_score": 0.82, "hard_filter": "PASS"}
    ben = {"interests": ["tailoring"], "home_district": "Nalanda",
           "education_class": 10, "mobility_km": 20, "self_employ_ok": True}
    out = explain_row(row, ben)
    assert _verdict(out, "interest") == CONFIRMED
    assert _verdict(out, "reachability") == CONFIRMED
    assert out["match_score"] == 82
    assert out["confirmed_count"] >= 4


def test_missing_inputs_are_unverified_not_failed():
    row = {"score_aspiration": 0.45, "score_demand": 0.0, "score_gap": 0.5,
           "score_mobility": 0.25, "score_history": 0.5, "distance_km": None,
           "total_score": 0.3, "hard_filter": "UNKNOWN"}
    ben = {"interests": [], "home_district": "Jind",
           "education_class": None, "mobility_km": None, "self_employ_ok": None}
    out = explain_row(row, ben)
    assert _verdict(out, "interest") == UNVERIFIED
    assert _verdict(out, "local_demand") == UNVERIFIED
    assert _verdict(out, "level_fit") == UNVERIFIED
    assert _verdict(out, "reachability") == UNVERIFIED
    assert _verdict(out, "work_preference") == UNVERIFIED
    assert _verdict(out, "eligibility") == UNVERIFIED
    assert out["confirmed_count"] == 0


def test_hard_filter_fail_surfaces():
    row = {"score_aspiration": 0.7, "total_score": 0.4, "hard_filter": "FAIL"}
    ben = {"interests": ["welding"], "home_district": "Patna",
           "education_class": 12, "self_employ_ok": False}
    out = explain_row(row, ben)
    assert _verdict(out, "eligibility") == FAIL


def test_demand_present_confirms_local_demand():
    row = {"score_demand": 0.4, "total_score": 0.5, "hard_filter": "PASS"}
    ben = {"interests": ["dairy"], "home_district": "Bhagalpur"}
    out = explain_row(row, ben)
    assert _verdict(out, "local_demand") == CONFIRMED


def test_centre_in_own_district_without_exact_distance_is_confirmed():
    # District-level locations: a centre is known, its exact distance isn't.
    row = {"score_mobility": 1.0, "distance_km": None, "total_score": 0.8,
           "centre_name": "Khordha Skill Development Centre",
           "centre_district": "Khordha", "hard_filter": "PASS"}
    ben = {"interests": ["mobile repair"], "home_district": "Khordha"}
    out = explain_row(row, ben)
    check = next(c for c in out["checks"] if c["factor"] == "reachability")
    assert check["verdict"] == CONFIRMED
    assert "Khordha" in check["detail"]


def test_centre_in_other_district_names_that_district():
    row = {"score_mobility": 0.25, "distance_km": None, "total_score": 0.6,
           "centre_name": "Cuttack Skill Development Centre",
           "centre_district": "Cuttack", "hard_filter": "PASS"}
    ben = {"interests": ["mobile repair"], "home_district": "Khordha"}
    out = explain_row(row, ben)
    check = next(c for c in out["checks"] if c["factor"] == "reachability")
    assert check["verdict"] == UNVERIFIED
    assert check["detail"] == "nearest centre is in Cuttack"
