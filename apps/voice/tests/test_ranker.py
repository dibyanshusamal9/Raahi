"""Ranker test skeleton — requires a live DATABASE_URL with seed loaded.
Skip if unavailable so the suite still runs elsewhere."""
import os, pytest
from app.services.ranker import recommend, stability_key


@pytest.mark.skipif(not os.getenv("DATABASE_URL"), reason="DB not configured")
def test_recommend_returns_ranked_list():
    from app.db import q
    b = q("select id from beneficiaries where phone_hash='demo_sunita_hash'")
    assert b, "seed data missing"
    top = recommend(b[0]["id"], top=3)
    assert 1 <= len(top) <= 3
    ranks = [r["rank"] for r in top]
    assert ranks == sorted(ranks)


def test_stability_key_shape():
    assert stability_key([]) == []
    assert stability_key([{"qp_code": "TEL/Q2100"}]) == ["TEL/Q2100"]
