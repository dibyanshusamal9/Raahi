"""Mock extractor behaviour — extract only what the answer states."""
import pytest
from app.services.extractor import _mock, skill_words_in
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


def test_textile_interest_in_any_script():
    # The English word written in Devanagari, as callers type and say it.
    p = _mock("What kind of work interests you?", "टेक्सटाइल्स", "hi")
    assert "textile" in (BeneficiaryPatch(**p).interests or [])
    p = _mock("What work interests you?", "textiles", "en")
    assert "textile" in (BeneficiaryPatch(**p).interests or [])


def test_skill_words_whole_words_only():
    vocab = ["electrician", "mobile", "mobile repair", "it", "textile"]
    assert skill_words_in("I want to become an electrician", vocab) == ["electrician"]
    # the longer phrase wins, and a plural counts
    assert skill_words_in("Mobile repair work", vocab) == ["mobile repair"]
    assert skill_words_in("Textiles", vocab) == ["textile"]
    # "it" is not found inside "with"
    assert skill_words_in("I want to work with my hands", vocab) == []


def test_skill_answer_translated_to_english(monkeypatch):
    """A Hindi skill answer is translated and searched in English, even though
    the rules read Hindi natively; with no translation nothing is added."""
    import asyncio
    from app.routers import session

    async def fake_to_english(text, lang, *, always=False):
        return {"इलेक्ट्रीशियन बनना है": "I want to become an electrician",
                "टेक्सटाइल्स": "Textiles"}.get(text, text) if always else text

    monkeypatch.setattr(session, "to_english", fake_to_english)
    monkeypatch.setattr(session, "_skill_vocabulary", lambda: ["electrician", "driver"])
    run = lambda heard: asyncio.run(session._english_interests(heard, "hi"))
    assert run("इलेक्ट्रीशियन बनना है") == ["electrician"]
    # not in the vocabulary, but short: kept for the course-name search
    assert run("टेक्सटाइल्स") == ["textiles"]
    # translation unavailable (returns the text unchanged): nothing to add
    assert run("कुछ और") == []
    assert asyncio.run(session._english_interests("driver", "en")) == []


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
