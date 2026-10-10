"""Officer site API: district officers add and maintain job openings
(demand_signals) through a form instead of writing SQL.

Officers sign in with their name and the officer access code
(OFFICER_ACCESS_CODE in .env) at POST /officer/login; every other endpoint
needs the session that returns (services/officer_auth.py). The officer's name
is stored with every entry. Only officer-entered rows can be edited or
deleted; seed and illustrative rows are read-only here.
"""
from __future__ import annotations
import datetime
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from ..db import q, exec_
from ..services import officer_auth
from ..services.officer_auth import require_officer

router = APIRouter(prefix="/officer", tags=["officer"])
signed_in = [Depends(require_officer)]

# The recommender only counts openings from the last 180 days; older than a
# year is almost certainly a typo.
MAX_AGE_DAYS = 365


def _origin(row: dict) -> str:
    if row.get("entered_by"):
        return "officer"
    if (row.get("source_url") or "").startswith("synthetic://"):
        return "illustrative"
    return "seed"


def _check_date(when: datetime.date) -> None:
    today = datetime.date.today()
    if when > today:
        raise HTTPException(422, "The date can't be in the future.")
    if when < today - datetime.timedelta(days=MAX_AGE_DAYS):
        raise HTTPException(422, "Only openings from the last 12 months can be added.")


def _check_link(url: str) -> None:
    if url and not url.startswith(("http://", "https://")):
        raise HTTPException(422, "The source link must start with http:// or https://.")


def _link_centres(district: str, qp_code: str) -> None:
    """A district's centres teach the courses it has jobs for (the rule in
    link_centre_courses(), migration 0016). Apply it to this course now, so
    callers in the district are offered a local centre for it."""
    exec_(
        """
        insert into centre_qualifications
               (centre_id, qualification_id, next_batch_date, seats_next_batch, documents_required)
        select tc.id, q.id,
               current_date + 10 + ((hashtext(tc.id::text || q.id::text) & 2147483647) %% 30),
               25, array['Aadhaar', 'Class certificate', 'Passport photo']
          from training_centres tc
          join qualifications q on q.qp_code = %s
         where tc.district = %s and tc.active
           and q.sector = any(tc.sectors) and not q.short_course
        on conflict (centre_id, qualification_id) do nothing
        """,
        (qp_code, district),
    )


def _unlink_centres(district: str, qp_code: str) -> None:
    """The reverse, once the district has no openings left for the course.
    Like link_centre_courses(), only touches the links it manages: those to
    official NQR courses and those of synthetic centres."""
    exec_(
        """
        delete from centre_qualifications cq
         using training_centres tc, qualifications q
         where tc.id = cq.centre_id and q.id = cq.qualification_id
           and tc.district = %s and q.qp_code = %s
           and (tc.source_url like 'synthetic://%%' or q.record_status = 'active')
           and not exists (select 1 from demand_signals d
                            where d.district = %s and d.qp_code = %s)
        """,
        (district, qp_code, district, qp_code),
    )


# ---------- signing in ----------

class Login(BaseModel):
    name: str = Field(max_length=200)
    code: str = Field(max_length=200)


@router.post("/login")
async def login(body: Login):
    name = " ".join(body.name.split())[:80]
    if not name:
        raise HTTPException(400, "Please enter your name.")
    if not officer_auth.code_matches(body.code):
        raise HTTPException(401, "That access code isn't right.")
    return {"name": name, "token": officer_auth.issue(name),
            "expires_in": officer_auth.SESSION_SECONDS}


# ---------- lists for the form ----------

@router.get("/states", dependencies=signed_in)
async def states():
    rows = q("select distinct state from indian_districts order by state")
    return {"states": [r["state"] for r in rows]}


@router.get("/districts", dependencies=signed_in)
async def districts(state: str):
    rows = q("select district from indian_districts where lower(state) = lower(%s) "
             "order by district", (state,))
    return {"districts": [r["district"] for r in rows]}


@router.get("/sectors", dependencies=signed_in)
async def sectors():
    rows = q("select distinct sector from qualifications "
             "where not short_course and sector is not null order by sector")
    return {"sectors": [r["sector"] for r in rows]}


@router.get("/courses", dependencies=signed_in)
async def courses(search: str = "", limit: int = 15):
    """Official NSQF job roles matching the search (name, job role, keywords
    or code). Names starting with the search come first, then names containing
    it, then the rest."""
    search = " ".join(search.split())
    if len(search) < 2:
        return {"courses": []}
    like = f"%{search}%"
    rows = q(
        """
        select qp_code, name, sector, nsqf_level
          from qualifications
         where not short_course
           and (name ilike %s or coalesce(job_role, '') ilike %s
                or coalesce(keywords, '') ilike %s or qp_code ilike %s)
         order by (name ilike %s) desc, (name ilike %s) desc, nsqf_level, name
         limit %s
        """,
        (like, like, like, like, f"{search}%", like, max(1, min(limit, 30))),
    )
    return {"courses": rows}


@router.get("/jobs", dependencies=signed_in)
async def jobs(district: str, limit: int = 300):
    """Job openings recorded for a district, officer entries first."""
    rows = q(
        """
        select id, district, state, sector, qp_code, role_title, vacancies_90d,
               median_wage_inr, source_url, source_note, entered_by, evidence_date,
               created_at,
               evidence_date >= current_date - 180 as counted
          from demand_signals
         where lower(district) = lower(%s)
         order by (entered_by is not null) desc, created_at desc, evidence_date desc
         limit %s
        """,
        (district, max(1, min(limit, 1000))),
    )
    for r in rows:
        r["origin"] = _origin(r)
    return {"jobs": rows}


# ---------- add / edit / delete ----------

class JobIn(BaseModel):
    state: str = Field(min_length=2, max_length=80)
    district: str = Field(min_length=2, max_length=80)
    qp_code: str | None = Field(None, max_length=80)        # official course, if picked
    role_title: str | None = Field(None, max_length=120)
    sector: str | None = Field(None, max_length=120)        # needed when no course is picked
    vacancies: int = Field(ge=1, le=100_000)
    median_wage_inr: int | None = Field(None, ge=1_000, le=500_000)
    evidence_date: datetime.date | None = None
    source_url: str | None = Field(None, max_length=500)
    source_note: str | None = Field(None, max_length=300)


@router.post("/jobs", status_code=201)
async def add_job(job: JobIn, officer: str = Depends(require_officer)):

    place = q("select district, state from indian_districts "
              "where lower(district) = lower(%s) and lower(state) = lower(%s)",
              (job.district.strip(), job.state.strip()))
    if not place:
        raise HTTPException(422, f"{job.district} is not a district of {job.state}.")
    district, state = place[0]["district"], place[0]["state"]

    qp_code = (job.qp_code or "").strip() or None
    role = " ".join((job.role_title or "").split())
    sector = (job.sector or "").strip()
    if qp_code:
        course = q("select name, sector from qualifications where qp_code = %s and not short_course",
                   (qp_code,))
        if not course:
            raise HTTPException(422, "That course isn't in the official course list.")
        sector, role = course[0]["sector"], role or course[0]["name"]
    else:
        if len(role) < 3:
            raise HTTPException(422, "Enter the job role, or pick it from the course list.")
        if not sector or not q("select 1 from qualifications where sector = %s limit 1", (sector,)):
            raise HTTPException(422, "Choose the sector this job belongs to.")

    when = job.evidence_date or datetime.date.today()
    _check_date(when)
    url = (job.source_url or "").strip()
    _check_link(url)
    note = " ".join((job.source_note or "").split()) or None

    row = q(
        """
        insert into demand_signals
               (district, state, sector, qp_code, role_title, vacancies_90d, median_wage_inr,
                source_url, source_note, entered_by, evidence_date)
        values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        returning *
        """,
        (district, state, sector, qp_code, role, job.vacancies, job.median_wage_inr,
         url or f"officer://{district}", note, officer, when),
    )[0]
    if qp_code:
        _link_centres(district, qp_code)
    row["origin"] = "officer"
    return {"job": row}


class JobUpdate(BaseModel):
    role_title: str | None = Field(None, max_length=120)
    vacancies: int | None = Field(None, ge=1, le=100_000)
    median_wage_inr: int | None = Field(None, ge=1_000, le=500_000)
    evidence_date: datetime.date | None = None
    source_url: str | None = Field(None, max_length=500)
    source_note: str | None = Field(None, max_length=300)


def _officer_row(job_id: str) -> dict:
    try:
        uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(404, "That job opening no longer exists.")
    rows = q("select * from demand_signals where id = %s::uuid", (job_id,))
    if not rows:
        raise HTTPException(404, "That job opening no longer exists.")
    if not rows[0]["entered_by"]:
        raise HTTPException(403, "Only openings entered by officers can be changed here.")
    return rows[0]


@router.patch("/jobs/{job_id}")
async def update_job(job_id: str, change: JobUpdate, officer: str = Depends(require_officer)):
    current = _officer_row(job_id)
    fields = change.model_dump(exclude_unset=True)
    if "vacancies" in fields and fields["vacancies"] is None:
        raise HTTPException(422, "Enter the number of openings.")
    if "role_title" in fields:
        fields["role_title"] = " ".join((fields["role_title"] or "").split())
        if len(fields["role_title"]) < 3:
            raise HTTPException(422, "Enter the job role.")
    if fields.get("evidence_date") is not None:
        _check_date(fields["evidence_date"])
    elif "evidence_date" in fields:
        raise HTTPException(422, "Enter the date of the information.")
    if "source_url" in fields:
        fields["source_url"] = (fields["source_url"] or "").strip()
        _check_link(fields["source_url"])
        # The column can't be empty: a cleared link becomes "no link".
        fields["source_url"] = fields["source_url"] or f"officer://{current['district']}"
    if "source_note" in fields:
        fields["source_note"] = " ".join((fields["source_note"] or "").split()) or None
    if not fields:
        raise HTTPException(422, "Nothing to change.")

    columns = {"vacancies": "vacancies_90d"}
    sets = ", ".join(f"{columns.get(k, k)} = %s" for k in fields)
    row = q(f"update demand_signals set {sets} where id = %s::uuid returning *",
            [*fields.values(), job_id])[0]
    row["origin"] = "officer"
    return {"job": row}


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, officer: str = Depends(require_officer)):
    row = _officer_row(job_id)
    exec_("delete from demand_signals where id = %s::uuid", (job_id,))
    if row["qp_code"]:
        _unlink_centres(row["district"], row["qp_code"])
    return {"deleted": job_id}
