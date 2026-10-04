"""Mock extractor behaviour — extract only what the answer states."""
import pytest
from app.services.extractor import _mock
from app.models.beneficiary import BeneficiaryPatch


def test_mobile_repair_interest():
    p = _mock("What are you interested in?", "mai mobile phone repair karna chahta hu", "hi")
    b = BeneficiaryPatch(**p)
    assert "telecom" in (b.interests or [])
    # The specific trade is kept too, not just its sector.
    assert "phone repair" in (b.interests or [])


def test_interest_keeps_callers_own_words():
    p = _mock("आपको किन कामों में रुचि है?", "mobile repair", "hi")
    b = BeneficiaryPatch(**p)
    assert "mobile repair" in (b.interests or [])
    assert "telecom" in (b.interests or [])
    p = _mock("What work interests you?", "weaving", "en")
    assert "weaving" in (BeneficiaryPatch(**p).interests or [])


def test_age_extraction():
    p = _mock("Umar?", "meri umar 24 saal hai", "hi")
    assert BeneficiaryPatch(**p).age == 24


def test_ambiguous_gives_no_field():
    p = _mock("Aap kya karte ho", "kuch bhi", "hi")
    b = BeneficiaryPatch(**p)
    assert b.age is None
    assert b.mobility_km is None
    assert b.social_category is None


def test_reject_out_of_range_age_via_schema():
    with pytest.raises(Exception):
        BeneficiaryPatch(age=200)
