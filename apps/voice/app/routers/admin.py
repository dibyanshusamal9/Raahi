"""Officer dashboard data. Every endpoint needs a signed-in officer
(services/officer_auth.py).

Demand vs supply, as the dashboard shows it:
  demand  calls received from callers who asked for a skill (caller_skills,
          migration 0019), counted against the official sector of that skill
  supply  job openings in that sector (demand_signals, last 180 days: the
          window the recommender counts)
"""
from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from ..services.ranker import recommend
from ..services.explain import trail
from ..services.officer_auth import require_officer
from ..logging import log
from ..db import q

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_officer)])


@router.post("/recommend/{bid}")
async def rec(bid: str, top: int = 3):
    return {"top": recommend(bid, top=top)}


@router.get("/explain/{rec_id}")
async def explain(rec_id: str):
    t = trail(rec_id)
    if not t:
        raise HTTPException(404, "recommendation not found")
    return t


# ---------- demand vs supply ----------

def _areas(district: str | None = None) -> list[dict]:
    """Per sector: calls from callers who asked for a skill in it (and which
    skills), against job openings in it. Nationally, or for one district."""
    only = "and district = %(d)s" if district else ""
    return q(
        f"""
        with asked as (
            select sector, skill, sum(calls)::int as calls
              from caller_skills
             where sector is not null and calls > 0 {only}
             group by sector, skill),
        demand as (
            select sector, sum(calls)::int as calls,
                   jsonb_agg(jsonb_build_object('skill', skill, 'calls', calls)
                             order by calls desc, skill) as skills
              from asked group by sector),
        supply as (
            select sector, sum(vacancies_90d)::int as openings
              from demand_signals
             where evidence_date >= current_date - 180 {only}
             group by sector)
        select coalesce(d.sector, s.sector)      as sector,
               coalesce(d.calls, 0)              as calls,
               coalesce(s.openings, 0)           as openings,
               coalesce(d.skills, '[]'::jsonb)   as skills
          from demand d
          full join supply s on s.sector = d.sector
         order by 2 desc, 3 desc, 1
        """,
        {"d": district} if district else None,
    )


@router.get("/overview")
async def overview():
    kpis = q(
        """
        select (select count(*) from sessions)::int as calls,
               (select count(*) from beneficiaries)::int as callers,
               (select count(distinct home_district) from beneficiaries
                 where home_district is not null)::int as districts_reached,
               (select coalesce(sum(vacancies_90d), 0) from demand_signals
                 where evidence_date >= current_date - 180)::int as openings,
               (select count(distinct district) from demand_signals
                 where evidence_date >= current_date - 180)::int as districts_with_openings,
               (select count(*) from training_centres where active)::int as centres
        """
    )[0]
    calls_by_day = q(
        """
        select d::date as day, count(s.id)::int as calls
          from generate_series(current_date - 29, current_date, interval '1 day') d
          left join sessions s on s.started_at::date = d::date
         group by 1 order by 1
        """
    )
    languages = q(
        """
        select coalesce(b.language, 'unknown') as language, count(*)::int as calls
          from sessions s join beneficiaries b on b.id = s.beneficiary_id
         group by 1 order by 2 desc, 1
        """
    )
    skills = q(
        """
        select skill, sum(calls)::int as calls
          from caller_skills
         where skill is not null and calls > 0
         group by skill order by 2 desc, 1
         limit 10
        """
    )
    # Every district, for the maps: where calls come from, where openings are.
    districts = q(
        """
        select i.district, i.state, i.latitude as lat, i.longitude as lon,
               coalesce(c.calls, 0)::int as calls, coalesce(o.openings, 0)::int as openings
          from indian_districts i
          left join (select b.home_district as district, count(s.id) as calls
                       from beneficiaries b join sessions s on s.beneficiary_id = b.id
                      group by 1) c on c.district = i.district
          left join (select district, sum(vacancies_90d) as openings
                       from demand_signals
                      where evidence_date >= current_date - 180
                      group by 1) o on o.district = i.district
         order by i.state, i.district
        """
    )
    return {"kpis": kpis, "calls_by_day": calls_by_day, "languages": languages,
            "skills": skills, "areas": _areas(), "districts": districts}


@router.get("/districts")
async def districts():
    """Every district with its calls, callers, openings and training centres."""
    rows = q(
        """
        with sec as (
            select district, sector, sum(vacancies_90d)::int as vac
              from demand_signals
             where evidence_date >= current_date - 180
             group by district, sector),
        supply as (
            select district, sum(vac)::int as openings,
                   (array_agg(sector order by vac desc, sector))[1] as top_sector
              from sec group by district),
        demand as (
            select b.home_district as district,
                   count(distinct b.id)::int as callers, count(s.id)::int as calls
              from beneficiaries b
              left join sessions s on s.beneficiary_id = b.id
             where b.home_district is not null
             group by 1),
        top_skill as (
            select distinct on (district) district, skill
              from (select district, skill, sum(calls) as calls
                      from caller_skills
                     where district is not null and skill is not null and calls > 0
                     group by 1, 2) x
             order by district, calls desc, skill),
        centres as (
            select district, count(*)::int as centres
              from training_centres where active group by district)
        select i.district, i.state,
               coalesce(demand.calls, 0)    as calls,
               coalesce(demand.callers, 0)  as callers,
               coalesce(supply.openings, 0) as openings,
               supply.top_sector,
               top_skill.skill              as top_skill,
               coalesce(centres.centres, 0) as centres
          from indian_districts i
          left join demand    on demand.district = i.district
          left join supply    on supply.district = i.district
          left join top_skill on top_skill.district = i.district
          left join centres   on centres.district = i.district
         order by 3 desc, 5 desc, 1
        """
    )
    return {"districts": rows}


@router.get("/districts/{district}/summary")
async def district_summary(district: str):
    place = q("select district, state from indian_districts where lower(district) = lower(%s)",
              (district,))
    if not place:
        raise HTTPException(404, "No such district.")
    d = place[0]["district"]
    kpis = q(
        """
        select (select count(s.id) from beneficiaries b
                  join sessions s on s.beneficiary_id = b.id
                 where b.home_district = %(d)s)::int as calls,
               (select count(*) from beneficiaries where home_district = %(d)s)::int as callers,
               (select coalesce(sum(vacancies_90d), 0) from demand_signals
                 where district = %(d)s and evidence_date >= current_date - 180)::int as openings,
               (select count(*) from training_centres
                 where district = %(d)s and active)::int as centres
        """,
        {"d": d},
    )[0]
    roles = q(
        """
        select role_title, sector, sum(vacancies_90d)::int as openings
          from demand_signals
         where district = %s and evidence_date >= current_date - 180
         group by role_title, sector
         order by 3 desc, 1
         limit 10
        """,
        (d,),
    )
    callers = q(
        """
        select b.id, coalesce(b.name, '—') as name, k.skill, b.language, b.updated_at,
               (select count(*) from sessions s where s.beneficiary_id = b.id)::int as calls,
               r.id as rec_id, r.top3 -> 0 ->> 'qualification_name' as top_course
          from beneficiaries b
          left join caller_skills k on k.beneficiary_id = b.id
          left join lateral (select id, top3 from recommendations
                              where beneficiary_id = b.id
                              order by created_at desc limit 1) r on true
         where b.home_district = %s
         order by b.updated_at desc
         limit 50
        """,
        (d,),
    )
    centres = q(
        """
        select tc.name, tc.address, tc.sectors,
               (select count(*) from centre_qualifications cq
                 where cq.centre_id = tc.id)::int as courses
          from training_centres tc
         where tc.district = %s and tc.active
         order by 4 desc, 1
         limit 8
        """,
        (d,),
    )
    funnel = q(
        """
        select e.state::text, count(*)::int as n
          from enrollments e
          join beneficiaries b on b.id = e.beneficiary_id
         where b.home_district = %s
         group by e.state
        """,
        (d,),
    )
    return {"district": d, "state": place[0]["state"], "kpis": kpis, "areas": _areas(d),
            "roles": roles, "callers": callers, "centres": centres, "funnel": funnel}


# ---------- beneficiaries ----------

@router.get("/beneficiaries")
async def beneficiaries(district: str | None = None):
    """Every beneficiary counselled so far — the persistent record, current AND
    historical (never just the latest session). Each row carries their profile,
    the skill they asked for in English, their latest recommendation and when
    they were seen."""
    where = "where b.home_district = %s" if district else ""
    params = (district,) if district else ()
    rows = q(
        f"""
        select
            b.id,
            coalesce(b.name, '—')                 as name,
            b.home_district                        as district,
            b.home_state                           as state,
            b.age,
            b.education_class,
            b.education_note,
            b.interests,
            b.aspiration,
            b.mobility_km,
            b.has_smartphone,
            b.self_employ_ok,
            b.social_category,
            b.language,
            b.created_at,
            b.updated_at,
            k.skill,
            (select count(*) from sessions s where s.beneficiary_id = b.id)::int as calls,
            r.id                                   as rec_id,
            r.top3,
            r.created_at                           as recommended_at
        from beneficiaries b
        left join caller_skills k on k.beneficiary_id = b.id
        left join lateral (select id, top3, created_at from recommendations
                            where beneficiary_id = b.id
                            order by created_at desc limit 1) r on true
        {where}
        order by lower(coalesce(b.home_state, 'zzz')),
                 lower(coalesce(b.home_district, 'zzz')),
                 lower(coalesce(k.skill, 'zzz')),
                 b.updated_at desc
        """,
        params,
    )
    return {"beneficiaries": rows, "count": len(rows)}


class DeleteBeneficiaries(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=1000)


@router.post("/beneficiaries/delete")
async def delete_beneficiaries(body: DeleteBeneficiaries, officer: str = Depends(require_officer)):
    """Delete beneficiaries and, through the foreign keys, all their calls,
    voice turns, recommendations and enrollments."""
    try:
        ids = [str(uuid.UUID(i)) for i in body.ids]
    except ValueError:
        raise HTTPException(422, "One of those beneficiary ids isn't valid.")
    rows = q("delete from beneficiaries where id = any(%s::uuid[]) returning id", (ids,))
    log.info("officer.beneficiaries_deleted", officer=officer, requested=len(ids), deleted=len(rows))
    return {"deleted": len(rows)}


@router.post("/erase/{phone_hash}")
async def erase(phone_hash: str):
    """DPDP right-to-erase."""
    rows = q("delete from beneficiaries where phone_hash=%s returning id", (phone_hash,))
    return {"deleted": len(rows)}


@router.get("/qualifications")
async def qualifications(sector: str | None = None, q_str: str | None = None):
    sql = "select id, qp_code, name, sector, nsqf_level, duration_hours, mode, self_employment_track, source_url from qualifications where 1=1"
    params = []
    if sector:
        sql += " and lower(sector) = lower(%s)"
        params.append(sector)
    if q_str:
        sql += " and (lower(name) like lower(%s) or lower(qp_code) like lower(%s))"
        params.extend([f"%{q_str}%", f"%{q_str}%"])
    sql += " order by sector, nsqf_level, name limit 200"
    return {"qualifications": q(sql, params)}
