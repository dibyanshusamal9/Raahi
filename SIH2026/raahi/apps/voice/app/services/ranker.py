"""FR-04 · Deterministic pathway ranker — thin wrapper over the SQL function.
No LLM in this path.

Centre lookup priority (for each recommended qualification):
  1. SQL ranker already found a centre within the caller's reach.
  2. No centre found → _attach_nearest_centre() picks the nearest active centre
     that teaches this course, wherever it is (`nearest_fallback=True`).
  3. No centre teaches it → leave centre_name null; the composer says no
     centre is listed. A centre that doesn't teach the course is never shown.
"""
from __future__ import annotations
import uuid, datetime, decimal
from ..db import q
from .match_explain import explain_row


def recommend(beneficiary_id: str, top: int = 3) -> list[dict]:
    rows = q("select * from recommend_pathways(%s::uuid)", (beneficiary_id,))
    cleaned = [_clean_row(r) for r in rows[:top]]

    # Safety net: if the ranker returned nothing fall back to the highest-demand
    # qualifications in the beneficiary's district.
    if not cleaned:
        cleaned = _fallback(beneficiary_id, top)

    _attach_centre_location(cleaned)      # enrich existing centre rows
    _attach_nearest_centre(cleaned, beneficiary_id)  # fill gaps with nearest
    _attach_explanations(beneficiary_id, cleaned)
    return cleaned


def _attach_explanations(beneficiary_id: str, rows: list[dict]) -> None:
    """Attach per-criterion checks + a 0-100 match score to each row."""
    if not rows:
        return
    bens = q("select * from beneficiaries where id=%s::uuid", (beneficiary_id,))
    ben = bens[0] if bens else {}
    for r in rows:
        try:
            r.update(explain_row(r, ben))
        except Exception:
            r.setdefault("checks", [])


def _attach_centre_location(rows: list[dict]) -> None:
    """Enrich rows that already have a centre_id with full address details."""
    ids = [r.get("centre_id") for r in rows if r.get("centre_id")]
    if not ids:
        return
    locs = q(
        "select id, name, district, state, address "
        "from training_centres where id = any(%s::uuid[])",
        (ids,),
    )
    by_id = {str(x["id"]): x for x in locs}
    for r in rows:
        cid = r.get("centre_id")
        loc = by_id.get(str(cid)) if cid else None
        if loc:
            r["centre_district"] = loc["district"]
            r["centre_state"] = loc["state"]
            # SQL ranker already returns centre_address; only fill if missing
            if not r.get("centre_address"):
                r["centre_address"] = loc["address"]
            r.setdefault("nearest_fallback", False)


def _attach_nearest_centre(rows: list[dict], beneficiary_id: str) -> None:
    """For every row that has NO training centre, find the nearest active centre
    that teaches the course, at any distance. If none does, the row keeps no
    centre and the composer says so.

    Distance is real km only when both locations are real, else None (we
    only show the centre name and district, not a misleading number).
    """
    missing = [r for r in rows if not r.get("centre_id")]
    if not missing:
        return

    # Load beneficiary location context
    bens = q(
        "select home_district, home_state, latitude, longitude "
        "from beneficiaries where id=%s::uuid",
        (beneficiary_id,),
    )
    ben = bens[0] if bens else {}
    b_state    = (ben.get("home_state") or "").strip()
    b_district = (ben.get("home_district") or "").strip()
    b_lat      = ben.get("latitude")
    b_lng      = ben.get("longitude")
    has_geo    = bool(b_lat and b_lng)

    for row in missing:
        centre = _find_nearest_centre(b_state, b_district, b_lat, b_lng, has_geo,
                                      row.get("qualification_id"))
        if centre:
            row["centre_id"]      = str(centre["id"])
            row["centre_name"]    = centre["name"]
            row["centre_address"] = centre["address"]
            row["centre_district"] = centre["district"]
            row["centre_state"]   = centre["state"]
            row["distance_km"]    = centre.get("distance_km")
            row["nearest_fallback"] = True
        else:
            row.setdefault("nearest_fallback", False)


def _find_nearest_centre(
    b_state: str,
    b_district: str,
    b_lat,
    b_lng,
    has_geo: bool,
    qualification_id: str | None = None,
) -> dict | None:
    """Return the closest active training centre that teaches
    `qualification_id`, or None if no centre teaches it.

    Preference: the caller's own district, then their state, then distance.
    Many districts sit on a shared placeholder point
    (indian_districts.approx_location), so a distance is returned only when
    neither end is one; otherwise distance_km is None and the caller hears the
    centre's district instead of a made-up number.
    """
    if not qualification_id:
        return None

    # Only a centre that actually teaches this course. Pointing the caller at
    # a centre that doesn't teach it is worse than saying none is listed.
    rows = q(
        """
        with c as (
            select tc.id, tc.name, tc.address, tc.district, tc.state,
                   lower(tc.district) = lower(%(district)s) as same_district,
                   lower(tc.state) = lower(%(state)s) as same_state,
                   case when %(has_geo)s and tc.latitude is not null then
                       round((earth_distance(
                           ll_to_earth(%(lat)s::float8, %(lng)s::float8),
                           ll_to_earth(tc.latitude, tc.longitude)) / 1000.0)::numeric, 1)
                   end as km,
                   %(has_geo)s and tc.latitude is not null
                   and not coalesce((select bool_or(d.approx_location) from indian_districts d
                                      where lower(d.district) = lower(%(district)s)), false)
                   and (tc.source_url not like 'synthetic://%%'
                        or not coalesce(dc.approx_location, false)) as km_known
            from training_centres tc
            join centre_qualifications cq on cq.centre_id = tc.id
            left join indian_districts dc on lower(dc.district) = lower(tc.district)
            where tc.active
              and cq.qualification_id = %(qid)s::uuid
        )
        select id, name, address, district, state,
               case when km_known then km end as distance_km
        from c
        -- Approximate distances still order centres sensibly (a state's
        -- centre point vs. another state's); they just aren't shown.
        order by same_district desc, same_state desc, km asc nulls last
        limit 1
        """,
        {"district": b_district, "state": b_state, "has_geo": has_geo,
         "lat": b_lat, "lng": b_lng, "qid": qualification_id},
    )
    return dict(rows[0]) if rows else None



def _clean_row(r: dict) -> dict:
    d = {}
    for k, v in r.items():
        if isinstance(v, (uuid.UUID, datetime.date, datetime.datetime)):
            d[k] = str(v)
        elif isinstance(v, decimal.Decimal):
            d[k] = float(v)
        else:
            d[k] = v
    return d


def _fallback(beneficiary_id: str, top: int) -> list[dict]:
    rows = q(
        """
        with b as (select * from beneficiaries where id = %s::uuid)
        select
            0 as rank,
            q.id as qualification_id,
            q.qp_code,
            q.name as qualification_name,
            q.sector,
            q.nsqf_level,
            q.duration_hours,
            null::uuid as centre_id,
            null::text as centre_name,
            null::text as centre_address,
            null::date as next_batch_date,
            null::numeric as distance_km,
            0.0 as total_score,
            0.0 as score_aspiration,
            coalesce(dem.vac_sum, 0)::numeric / 200.0 as score_demand,
            0.0 as score_mobility,
            0.0 as score_gap,
            0.5 as score_history,
            'UNKNOWN' as hard_filter
        from qualifications q
        left join (
            select d.sector, sum(d.vacancies_90d)::numeric as vac_sum
            from demand_signals d, b
            where d.district = b.home_district
              and d.evidence_date >= (current_date - interval '180 days')
            group by d.sector
        ) dem on lower(dem.sector) = lower(q.sector)
        where not q.short_course
        order by coalesce(dem.vac_sum,0) desc,
                 q.nsqf_level desc,
                 q.qp_code
        limit %s
        """,
        (beneficiary_id, top),
    )
    return [_clean_row(r) for r in rows]


def stability_key(top3: list[dict]) -> list[str]:
    return [r["qp_code"] for r in top3]
