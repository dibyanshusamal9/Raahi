"""Generate db/seed/seed_demand_all_india.sql — synthetic demand_signals rows
across every Indian district, in the same format as seed.sql. The row count is
chosen so that, together with the hand-written jobs in seed.sql and
seed_nsqf_expansion.sql, demand_signals holds exactly TOTAL_JOBS rows.

Roles are real ACTIVE NSQF qualifications from the Official India Data Pack
(data/raw/raahi-official-dataset.xlsx, sheet "NQR Qualifications"). qp_code
and sector are derived exactly the way ingesters/import_official_dataset.py
stores them, so after the official import the ranker matches every row by
qp_code (and, by sector, every other course in the same sector).
Districts come from the indian_districts migrations (0011 + 0012) so names
match beneficiaries.home_district exactly.

Vacancy counts and wages are SYNTHETIC (regionally weighted, deterministic
seed) — rows are tagged source_url='synthetic://setu-demo/ncs-style' so they
can never be mistaken for real NCS evidence. evidence_date is written relative
to current_date so the rows stay inside the ranker's 180-day demand window
whenever the database is rebuilt. The generated file deletes earlier synthetic
rows first (in one transaction), so re-running it never duplicates them.

    python db/seed/gen_demand_all_india.py
"""
from __future__ import annotations

import random
import re
import sys
from collections import Counter
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT))
# Reuse the importer's own normalisation so codes/sectors match byte-for-byte.
from ingesters.import_official_dataset import (  # noqa: E402
    DEFAULT_XLSX, as_int, clean, nsqf_level,
)

MIGRATIONS = HERE.parent / "migrations"
OUT = HERE / "seed_demand_all_india.sql"
# Hand-written jobs that also land in demand_signals (their `seed_jobs` block).
SEED_FILES = [HERE / "seed.sql", HERE / "seed_nsqf_expansion.sql"]
TOTAL_JOBS = 20_000
SOURCE_URL = "synthetic://setu-demo/ncs-style"
rng = random.Random(2026)

# NQR sector names (after the importer's NFKC clean()).
AGRI = "Agriculture"
APPAREL = "Apparel"
AUTO = "Automotive"
BEAUTY = "Beauty & Wellness"
CAREGIVING = "Home Management and Caregiving"
CONSTRUCTION = "Construction"
CRAFTS = "Handicrafts & Carpets"
ELECTRONICS = "Electronics & HW"
FOOD = "Food Industry/Food Processing"
GEMS = "Gem & Jewellery"
HANDLOOM = "Textile & Handloom"
HEALTH = "Healthcare"
IT = "IT-ITeS"
LEATHER = "Leather"
LOGISTICS = "Transportation, Logistics & Warehousing"
MANUFACTURING = "Capital Goods & Manufacturing"
MINING = "Mining"
OFFICE = "Office Administration & Facility Management"
PLUMBING = "Plumbing"
POWER = "Power"
RETAIL = "Retail"
SECURITY = "Private Security"
TELECOM = "Telecom"
TOURISM = "Tourism & Hospitality"
WOOD = "Wood & Carpentry"

# Baseline sector weight everywhere (rural-heavy, like the pilot districts).
# Sectors not listed here are left out of the jobs data.
BASE = {
    AGRI: 5, CONSTRUCTION: 4, RETAIL: 3, TELECOM: 3, APPAREL: 2.5,
    BEAUTY: 2, ELECTRONICS: 2, AUTO: 2, HEALTH: 2, FOOD: 2,
    LOGISTICS: 1.5, HANDLOOM: 1.2, CAREGIVING: 1, TOURISM: 1,
    CRAFTS: 0.8, PLUMBING: 0.8, SECURITY: 0.8, OFFICE: 0.8,
    MANUFACTURING: 0.7, WOOD: 0.6, LEATHER: 0.5, POWER: 0.5,
    IT: 0.3, GEMS: 0.3, MINING: 0.3,
}
# State-level boosts reflecting known clusters (handloom belts, garment hubs,
# tourism states, industrial corridors, mining belts).
STATE_BOOST = {
    "Bihar": {HANDLOOM: 3, AGRI: 1.3},
    "Uttar Pradesh": {HANDLOOM: 3, APPAREL: 1.5, CRAFTS: 2, LEATHER: 2},
    "West Bengal": {HANDLOOM: 3, APPAREL: 1.5, CRAFTS: 1.5},
    "Assam": {HANDLOOM: 4, TOURISM: 1.5},
    "Manipur": {HANDLOOM: 4}, "Nagaland": {HANDLOOM: 3},
    "Mizoram": {HANDLOOM: 3}, "Tripura": {HANDLOOM: 3},
    "Arunachal Pradesh": {HANDLOOM: 2, TOURISM: 2},
    "Meghalaya": {HANDLOOM: 2, TOURISM: 2},
    "Odisha": {HANDLOOM: 3, AGRI: 1.2, MINING: 3},
    "Andhra Pradesh": {HANDLOOM: 2.5, FOOD: 1.5},
    "Telangana": {HANDLOOM: 2.5, IT: 2},
    "Tamil Nadu": {HANDLOOM: 2, APPAREL: 3, MANUFACTURING: 2.5, AUTO: 2, LEATHER: 3},
    "Karnataka": {APPAREL: 2.5, IT: 2, MANUFACTURING: 1.5},
    "Kerala": {TOURISM: 3, HEALTH: 2, HANDLOOM: 1.5, CAREGIVING: 2},
    "Goa": {TOURISM: 4},
    "Rajasthan": {TOURISM: 2.5, HANDLOOM: 1.5, CRAFTS: 2.5, GEMS: 3, MINING: 2},
    "Himachal Pradesh": {TOURISM: 3, FOOD: 1.5},
    "Uttarakhand": {TOURISM: 3},
    "Jammu and Kashmir": {TOURISM: 2.5, HANDLOOM: 2, CRAFTS: 3},
    "Ladakh": {TOURISM: 3},
    "Sikkim": {TOURISM: 3},
    "Punjab": {APPAREL: 2, AGRI: 1.5, FOOD: 2},
    "Haryana": {APPAREL: 2, AUTO: 2.5, LOGISTICS: 2, MANUFACTURING: 2},
    "Gujarat": {APPAREL: 2, MANUFACTURING: 2.5, LOGISTICS: 2, GEMS: 3},
    "Maharashtra": {MANUFACTURING: 2, AUTO: 2, LOGISTICS: 2, IT: 1.5},
    "Madhya Pradesh": {AGRI: 1.4, CONSTRUCTION: 1.3},
    "Chhattisgarh": {AGRI: 1.4, CONSTRUCTION: 1.3, MINING: 3},
    "Jharkhand": {CONSTRUCTION: 1.5, AGRI: 1.2, MINING: 3},
    "Delhi": {RETAIL: 2, LOGISTICS: 2.5, IT: 2, HEALTH: 1.5, SECURITY: 2},
}
URBAN = {
    "Bengaluru Urban", "Hyderabad", "Pune", "Chennai", "Mumbai", "Mumbai Suburban",
    "Kolkata", "Ahmedabad", "Gurugram", "Gautam Buddha Nagar", "Thane",
    "New Delhi", "Central Delhi", "South Delhi", "Jaipur", "Lucknow", "Indore",
    "Patna", "Coimbatore", "Kochi", "Ernakulam", "Nagpur", "Surat", "Vadodara",
    "Visakhapatnam", "Bhopal", "Chandigarh", "Ludhiana", "Rangareddy",
    "Medchal-Malkajgiri", "Faridabad", "Ghaziabad", "Kanpur Nagar",
}
URBAN_BOOST = {IT: 8, RETAIL: 2, LOGISTICS: 2.5, HEALTH: 1.8,
               TOURISM: 1.5, MANUFACTURING: 1.5, SECURITY: 2, OFFICE: 2,
               AGRI: 0.3}
# Rural callers mostly fit NSQF 3-4; cities pull towards 4-5.
LEVEL_WEIGHT = {False: {2: 1.5, 3: 3, 4: 3, 5: 0.3}, True: {2: 0.5, 3: 1.5, 4: 3, 5: 3}}
# Monthly-wage multiplier by state (cost of living / prevailing wages).
WAGE_MULT = {
    "Bihar": 0.85, "Uttar Pradesh": 0.9, "Madhya Pradesh": 0.9, "Jharkhand": 0.88,
    "Odisha": 0.9, "Chhattisgarh": 0.9, "Assam": 0.92, "Rajasthan": 0.95,
    "West Bengal": 0.95, "Tripura": 0.9, "Manipur": 0.92,
    "Maharashtra": 1.15, "Karnataka": 1.12, "Tamil Nadu": 1.1, "Kerala": 1.15,
    "Delhi": 1.25, "Haryana": 1.15, "Gujarat": 1.08, "Goa": 1.2, "Punjab": 1.08,
    "Telangana": 1.1,
}
BASE_WAGE = {2: 9500, 3: 10500, 4: 13000, 5: 18500}   # INR / month by NSQF level
# Job-role qualifications only (skip micro-credentials / upskilling add-ons).
JOB_TYPES = ("General Qualification", "Apprenticeship Qualification")
# Course-style titles rather than job roles.
NOT_A_ROLE = re.compile(r"^(fundamentals|basics) of", re.I)
# NG-/NM- codes are short add-on courses (e.g. "First Aid Care"), not job roles.
SHORT_COURSE = re.compile(r"^(NCVET-)?N[GM]-")
# Roles that only make sense in big cities.
URBAN_ONLY = re.compile(r"manager|analyst|metro rail|luxury|e-commerce", re.I)
# Sectors with only a handful of NQR roles get proportionally fewer rows,
# so one role is not repeated across hundreds of districts.
FULL_SECTOR_ROLES = 6


def load_qualifications() -> dict[str, list[tuple[str, str, int]]]:
    """Active NQR rows as {sector: [(qp_code, role_title, nsqf_level)]},
    with qp_code built exactly like import_official_dataset.load_qualifications."""
    df = pd.read_excel(DEFAULT_XLSX, sheet_name="NQR Qualifications")
    active = df[df["record_status"].astype(str).str.lower() == "active"]
    seen: set[str] = set()
    by_sector: dict[str, list[tuple[str, str, int]]] = {}
    for _, r in active.iterrows():
        code = clean(r.get("qualification_code")) or f"NQR/{as_int(r.get('nqr_row_id'))}"
        if code in seen:
            code = f"{code}#{as_int(r.get('nqr_row_id'))}"
        seen.add(code)
        sector = clean(r.get("sector_name")) or "General"
        level = nsqf_level(r.get("nsqf_level"))
        qtype = clean(r.get("qualification_type")) or ""
        if sector not in BASE or not 2 <= level <= 5:
            continue
        title = clean(r.get("title")) or code
        if (not any(t in qtype for t in JOB_TYPES) or NOT_A_ROLE.match(title)
                or SHORT_COURSE.match(code)):
            continue
        if title.isupper():
            title = title.title()
        by_sector.setdefault(sector, []).append((code, title, level))
    return by_sector


def load_districts() -> list[tuple[str, str]]:
    pat = re.compile(r"\('((?:[^']|'')+)','((?:[^']|'')+)',\s*-?[\d.]+,\s*-?[\d.]+\)")
    seen, out = set(), []
    for f in ("0011_indian_districts.sql", "0012_all_india_districts.sql"):
        for d, s in pat.findall((MIGRATIONS / f).read_text(encoding="utf-8")):
            d, s = d.replace("''", "'"), s.replace("''", "'")
            if d.lower() not in seen:
                seen.add(d.lower())
                out.append((d, s))
    return out


def sector_weights(district: str, state: str) -> dict[str, float]:
    w = dict(BASE)
    for k, m in STATE_BOOST.get(state, {}).items():
        w[k] *= m
    if district in URBAN:
        for k, m in URBAN_BOOST.items():
            w[k] *= m
    return w


def pick_role(quals, district: str, state: str, used: set[str]) -> tuple:
    urban = district in URBAN
    w = sector_weights(district, state)

    def fits(q: tuple) -> bool:
        return q[0] not in used and (urban or not URBAN_ONLY.search(q[1]))

    open_sectors = [s for s in quals if any(fits(q) for q in quals[s])]
    sector = rng.choices(open_sectors, weights=[
        w[s] * min(1.0, len(quals[s]) / FULL_SECTOR_ROLES) for s in open_sectors])[0]
    pool = [q for q in quals[sector] if fits(q)]
    code, title, level = rng.choices(
        pool, weights=[LEVEL_WEIGHT[urban][q[2]] for q in pool])[0]
    return code, sector, title, level


def sql_str(v: str) -> str:
    return "'" + v.replace("'", "''") + "'"


def count_seed_jobs() -> int:
    n = 0
    for f in SEED_FILES:
        block = f.read_text(encoding="utf-8").split("with seed_jobs", 1)[1]
        block = block.split("), removed as", 1)[0]
        n += sum(1 for line in block.splitlines() if line.lstrip().startswith("('"))
    return n


def main() -> None:
    quals = load_qualifications()
    districts = load_districts()
    seed_jobs = count_seed_jobs()
    n_rows = TOTAL_JOBS - seed_jobs
    # Every district gets at least one row; the rest of the budget goes
    # preferentially to urban districts.
    rng.shuffle(districts)
    rows_per = {d: 1 for d in districts}
    weights = [4 if d[0] in URBAN else 1 for d in districts]
    for d in rng.choices(districts, weights=weights, k=n_rows - len(districts)):
        rows_per[d] += 1

    lines, sectors = [], Counter()
    for (district, state), n in sorted(rows_per.items(), key=lambda x: (x[0][1], x[0][0])):
        used: set[str] = set()
        urban = district in URBAN
        for _ in range(n):
            code, sector, role, level = pick_role(quals, district, state, used)
            used.add(code)
            sectors[sector] += 1
            # Per-role openings stay modest: with ~25 roles per district, a
            # sector's total still spreads across the ranker's 0-150 demand scale.
            vac = int(rng.triangular(5, 180, 40) if urban else rng.triangular(3, 90, 12))
            wage = BASE_WAGE[level] * WAGE_MULT.get(state, 1.0) * (1.2 if urban else 1.0)
            wage = int(round(wage * rng.uniform(0.88, 1.12) / 500) * 500)
            days_ago = rng.randint(3, 75)
            lines.append(
                f"({sql_str(district)},{sql_str(state)},{sql_str(sector)},"
                f"{sql_str(code)},{sql_str(role)},{vac}, {wage}, "
                f"{sql_str(SOURCE_URL)},current_date - {days_ago})"
            )
    assert len(lines) == n_rows, len(lines)

    header = f"""-- All-India demand signals — {n_rows:,} rows across {len(rows_per)} districts.
-- With the {seed_jobs} hand-written jobs in seed.sql + seed_nsqf_expansion.sql,
-- demand_signals holds {TOTAL_JOBS:,} rows in total.
-- Generated by db/seed/gen_demand_all_india.py (deterministic). Same columns as
-- the demand_signals block in seed.sql. Roles are ACTIVE NQR qualifications
-- from data/raw/raahi-official-dataset.xlsx, with qp_code/sector exactly as
-- ingesters/import_official_dataset.py stores them.
-- SYNTHETIC: vacancy and wage figures are illustrative (regionally weighted),
-- NOT real NCS data. Tagged source_url='{SOURCE_URL}'.
-- evidence_date is relative to load time so rows stay in the ranker's window.
--
-- Safe to re-run: deletes every earlier synthetic row, then inserts these.

-- Files are UTF-8; say so explicitly so psql on Windows doesn't read them as WIN1252.
set client_encoding = 'UTF8';

begin;

delete from demand_signals where source_url like 'synthetic://%';

insert into demand_signals (district, state, sector, qp_code, role_title, vacancies_90d, median_wage_inr, source_url, evidence_date) values
"""
    footer = (";\n\n-- Centres offer the courses their district has jobs for, so rebuild\n"
              "-- those links for the new jobs data (migration 0016).\n"
              "select link_centre_courses();\n\ncommit;\n")
    OUT.write_text(header + ",\n".join(lines) + footer, encoding="utf-8")
    print(f"wrote {OUT.name}: {len(lines):,} rows + {seed_jobs} hand-written = "
          f"{len(lines) + seed_jobs:,} jobs, {len(rows_per)} districts, "
          f"{sum(len(v) for v in quals.values())} eligible NQR roles")
    for s, c in sectors.most_common():
        print(f"  {c:4d}  {s}  ({len(quals[s])} roles available)")


if __name__ == "__main__":
    main()
