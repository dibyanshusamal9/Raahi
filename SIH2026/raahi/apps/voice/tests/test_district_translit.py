# -*- coding: utf-8 -*-
"""District matching across scripts.

Callers speak their district in their own language, so STT hands us the name in
native script while the reference table stores Latin. These tests lock in that
native-script districts resolve to the canonical Latin name, that unrelated
words are still rejected, and that common colonial spellings map through.
"""
import pytest

from app.services.translit import to_latin, has_indic
from app.settings import settings


# --- transliteration unit tests (no DB) -------------------------------------

def test_translit_devanagari():
    assert to_latin("पटना").startswith("pat")
    assert "z" in to_latin("मुज़फ़्फ़रपुर")   # nukta letters ज़/फ़ -> z/f


def test_translit_nukta_decomposed_equals_precomposed():
    # ज़ as one code point vs base + nukta must romanise identically
    assert to_latin("ज़") == to_latin("ज" + "़")


def test_translit_scripts_detected():
    assert has_indic("पटना") and has_indic("কলকাতা") and has_indic("சென்னை")
    assert not has_indic("Patna")


# --- district resolution (needs the local/Supabase DB) ----------------------

pytestmark = pytest.mark.skipif(
    not settings.database_url,
    reason="district lookup needs DATABASE_URL (indian_districts table)",
)


@pytest.mark.parametrize("spoken,canonical", [
    ("पटना", "Patna"),         # must NOT resolve to Patan (Gujarat)
    ("भागलपुर", "Bhagalpur"),
    ("नालंदा", "Nalanda"),
    ("झाबुआ", "Jhabua"),
    ("मुज़फ़्फ़रपुर", "Muzaffarpur"),  # schwa deletion keeps the a's
    ("जीन्द", "Jind"),          # was reported missing before full seed
    ("Jind", "Jind"),
    ("Rohtak", "Rohtak"),
    ("কলকাতা", "Kolkata"),
    ("சென்னை", "Chennai"),
    ("लखनऊ", "Lucknow"),      # via alias (colonial spelling)
    ("Calcutta", "Kolkata"),  # English variant via alias
])
def test_native_district_accepted(spoken, canonical):
    from app.routers.session import _validate_patch
    patch = {"home_district": spoken}
    rejected = _validate_patch(patch)
    assert not rejected, f"{spoken!r} was rejected"
    assert patch["home_district"] == canonical


@pytest.mark.parametrize("garbage", ["दसवीं", "हाँ", "सिलाई", "Berlin", "London"])
def test_non_district_rejected(garbage):
    from app.routers.session import _validate_patch
    patch = {"home_district": garbage}
    rejected = _validate_patch(patch)
    assert "home_district" in rejected
    assert "home_district" not in patch
