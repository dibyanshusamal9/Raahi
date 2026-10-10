"""Load the Official India Data Pack into Postgres.

★ THIS IS THE SOLE DATA INGESTION SOURCE ★
All web scrapers (ncs_scraper, nsqf_scraper) have been removed.
This importer is the only way qualifications enter the system.

Source: data/raw/raahi-official-dataset.xlsx (5 sheets — NQR qualifications,
Census SC district profiles, PM-AJAY rules, official sources, README).

The workbook is resolved in this order:
  1. --xlsx <path>  argument passed on the command line
  2. OFFICIAL_DATASET_XLSX environment variable
  3. data/raw/raahi-official-dataset.xlsx (auto-detected)

This REPLACES the qualifications corpus with the official active NQR set and
loads the pack's reference tables. Run after migrations:

    python -m ingesters.import_official_dataset
    python -m ingesters.import_official_dataset --xlsx "/path/to/pack.xlsx"

Notes:
  * Only ACTIVE NQR rows become `qualifications` (README: use active only for
    live recommendations). All rows (active + expired) are kept in
    `nqr_qualifications_raw` for audit.
  * The pack has NO training centres or live demand — those tables are left as
    they are; refresh them from the Official sources sheet separately.
  * NSQF half-levels (e.g. 4.5) are floored and clamped to the schema's 1..8.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import unicodedata
from datetime import datetime, date
from pathlib import Path

import pandas as pd
import psycopg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

# Portable default: look for the workbook in the project root, or use the
# OFFICIAL_DATASET_XLSX env-var to point at it from any location.
_env_xlsx = os.getenv("OFFICIAL_DATASET_XLSX", "")
DEFAULT_XLSX = (
    Path(_env_xlsx) if _env_xlsx
    else ROOT / "data" / "raw" / "raahi-official-dataset.xlsx"
)
DATABASE_URL = os.getenv("DATABASE_URL",
                          "postgresql://postgres:postgres@localhost:5432/raahi")

# Sectors that typically lead to own-account / micro-enterprise work.
_SELF_EMPLOY_HINTS = (
    "handloom", "handicraft", "textile", "apparel", "agriculture", "agri",
    "food processing", "beauty", "wellness", "tourism", "hospitality",
    "leather", "gems", "jewellery", "craft", "dairy", "animal",
)


def clean(v) -> str | None:
    """NFKC-normalise (fixes ligatures like 'Oﬃce' -> 'Office'), trim, and turn
    blanks / NaN into None."""
    if v is None:
        return None
    if isinstance(v, float) and pd.isna(v):
        return None
    s = unicodedata.normalize("NFKC", str(v)).strip()
    return s or None


def as_int(v, default=None):
    try:
        if v is None or (isinstance(v, float) and pd.isna(v)):
            return default
        return int(float(v))
    except (ValueError, TypeError):
        return default


def as_num(v):
    try:
        if v is None or (isinstance(v, float) and pd.isna(v)):
            return None
        return float(v)
    except (ValueError, TypeError):
        return None


def as_date(v):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    if isinstance(v, (datetime, date)):
        return v if isinstance(v, date) else v.date()
    try:
        return pd.to_datetime(v).date()
    except Exception:
        return None


def as_bool(v):
    s = clean(v)
    if s is None:
        return None
    return s.lower() in ("true", "yes", "y", "1")


def nsqf_level(v) -> int:
    """Floor NSQF half-levels and clamp to the schema's 1..8."""
    n = as_int(v, default=3)
    return max(1, min(8, n))


def self_employment(sector: str | None) -> bool:
    s = (sector or "").lower()
    return any(h in s for h in _SELF_EMPLOY_HINTS)


# --------------------------------------------------------------------------

def load_sources(cur, df) -> dict[str, str]:
    url_by_id: dict[str, str] = {}
    for _, r in df.iterrows():
        sid = clean(r.get("source_id"))
        if not sid:
            continue
        url = clean(r.get("url"))
        url_by_id[sid] = url or ""
        cur.execute(
            """insert into data_sources
               (source_id, name, owner, url, data_area, format, access_method,
                bulk_available, suggested_refresh, included, notes)
               values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
               on conflict (source_id) do update set
                 name=excluded.name, owner=excluded.owner, url=excluded.url,
                 data_area=excluded.data_area, format=excluded.format,
                 access_method=excluded.access_method,
                 bulk_available=excluded.bulk_available,
                 suggested_refresh=excluded.suggested_refresh,
                 included=excluded.included, notes=excluded.notes""",
            (sid, clean(r.get("name")), clean(r.get("owner")), url,
             clean(r.get("data_area")), clean(r.get("format")),
             clean(r.get("access_method")), clean(r.get("bulk_available")),
             clean(r.get("suggested_refresh")), clean(r.get("included")),
             clean(r.get("notes"))),
        )
    return url_by_id


def load_rules(cur, df) -> int:
    n = 0
    for _, r in df.iterrows():
        rid = clean(r.get("rule_id"))
        if not rid:
            continue
        cur.execute(
            """insert into pmajay_rules
               (rule_id, category, rule_name, rule_text, operator,
                threshold_value, threshold_unit, hard_gate, source_id, source_section)
               values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
               on conflict (rule_id) do update set
                 category=excluded.category, rule_name=excluded.rule_name,
                 rule_text=excluded.rule_text, operator=excluded.operator,
                 threshold_value=excluded.threshold_value,
                 threshold_unit=excluded.threshold_unit,
                 hard_gate=excluded.hard_gate, source_id=excluded.source_id,
                 source_section=excluded.source_section""",
            (rid, clean(r.get("category")), clean(r.get("rule_name")),
             clean(r.get("rule_text")), clean(r.get("operator")),
             as_num(r.get("threshold_value")), clean(r.get("threshold_unit")),
             as_bool(r.get("hard_gate")), clean(r.get("source_id")),
             clean(r.get("source_section"))),
        )
        n += 1
    return n


def load_profiles(cur, df) -> int:
    cols = [
        "census_state_code", "census_district_code", "state_name_2011",
        "district_name_2011", "households", "total_population", "male_population",
        "female_population", "age_0_6_population", "sc_population",
        "sc_male_population", "sc_female_population", "st_population",
        "literate_population", "illiterate_population", "total_workers",
        "main_workers", "main_cultivators", "main_agricultural_labourers",
        "main_household_industry_workers", "main_other_workers",
        "marginal_workers", "non_workers", "sc_share_pct",
        "worker_population_pct", "source_id", "retrieved_at",
    ]
    bigints = set(cols[4:23])
    n = 0
    for _, r in df.iterrows():
        sc = clean(r.get("census_state_code"))
        dc = clean(r.get("census_district_code"))
        if not sc or not dc:
            continue
        vals = []
        for c in cols:
            if c in ("census_state_code", "census_district_code",
                     "state_name_2011", "district_name_2011", "source_id"):
                vals.append(clean(r.get(c)))
            elif c in bigints:
                vals.append(as_int(r.get(c)))
            elif c in ("sc_share_pct", "worker_population_pct"):
                vals.append(as_num(r.get(c)))
            else:  # retrieved_at
                vals.append(as_date(r.get(c)))
        placeholders = ",".join(["%s"] * len(cols))
        cur.execute(
            f"insert into district_sc_profiles ({','.join(cols)}) "
            f"values ({placeholders}) "
            f"on conflict (census_state_code, census_district_code) do nothing",
            vals,
        )
        n += 1
    return n


def load_qualifications(cur, df, url_by_id: dict[str, str]) -> tuple[int, int]:
    # Full corpus -> audit table.
    raw_n = 0
    for _, r in df.iterrows():
        rid = as_int(r.get("nqr_row_id"))
        if rid is None:
            continue
        row = {k: (None if (isinstance(v, float) and pd.isna(v)) else v)
               for k, v in r.items()}
        cur.execute(
            """insert into nqr_qualifications_raw
               (nqr_row_id, title, qualification_code, sector_name,
                nsqf_level_raw, record_status, valid_till, source_id,
                retrieved_at, data)
               values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
               on conflict (nqr_row_id) do update set
                 record_status=excluded.record_status, data=excluded.data""",
            (rid, clean(r.get("title")), clean(r.get("qualification_code")),
             clean(r.get("sector_name")), clean(r.get("nsqf_level_raw")),
             clean(r.get("record_status")), as_date(r.get("valid_till")),
             clean(r.get("source_id")), as_date(r.get("retrieved_at")),
             json.dumps(row, default=str, ensure_ascii=False)),
        )
        raw_n += 1

    # Replace live qualifications with the ACTIVE set. TRUNCATE ... CASCADE also
    # clears everything tied to the old corpus (centre_qualifications,
    # qualification_eligibility/pathways/modules, and the stale demo
    # enrollments) — all of which are meaningless against a new corpus.
    cur.execute("truncate table qualifications cascade")
    active = df[df["record_status"].astype(str).str.lower() == "active"]
    seen: set[str] = set()
    live_n = 0
    for _, r in active.iterrows():
        code = clean(r.get("qualification_code")) or f"NQR/{as_int(r.get('nqr_row_id'))}"
        if code in seen:                          # keep qp_code unique
            code = f"{code}#{as_int(r.get('nqr_row_id'))}"
        seen.add(code)
        sector = clean(r.get("sector_name")) or "General"
        src_id = clean(r.get("source_id"))
        source_url = url_by_id.get(src_id or "", "") or "https://www.nqr.gov.in/"
        keywords = " ".join(filter(None, [
            clean(r.get("description")), clean(r.get("progression_pathway")),
            clean(r.get("proposed_occupation")), clean(r.get("awarding_body")),
        ]))[:4000]
        cur.execute(
            """insert into qualifications
               (qp_code, name, sector, nsqf_level, duration_hours,
                entry_min_age, mode, self_employment_track, source_url,
                evidence_date, job_role, keywords, record_status, valid_till,
                awarding_body)
               values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (code, clean(r.get("title")) or code, sector,
             nsqf_level(r.get("nsqf_level")),
             as_int(r.get("maximum_notional_hours"), 0) or 0,
             18, "classroom", self_employment(sector), source_url,
             as_date(r.get("retrieved_at")) or date.today(),
             clean(r.get("proposed_occupation")), keywords,
             "active", as_date(r.get("valid_till")),
             clean(r.get("awarding_body"))),
        )
        live_n += 1
    return live_n, raw_n


def relink_centre_qualifications(cur) -> int:
    """Re-link training centres to the new NQR qualifications after the
    TRUNCATE qualifications CASCADE wiped centre_qualifications.

    Uses link_centre_courses() (migration 0016): each centre offers the
    courses its district has job openings for in demand_signals, within the
    sectors listed in training_centres.sectors. The same rule runs when the
    jobs or centre seed files are loaded, so links agree whatever the order.
    """
    cur.execute("select link_centre_courses()")
    return cur.fetchone()[0]


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Load data/raw/raahi-official-dataset.xlsx into Postgres. "
                    "This is the SOLE data ingestion source for the system."
    )
    ap.add_argument(
        "--xlsx",
        default=str(DEFAULT_XLSX),
        help="Path to the Official India Data Pack workbook "
             "(default: data/raw/raahi-official-dataset.xlsx, "
             "or OFFICIAL_DATASET_XLSX env var)",
    )
    args = ap.parse_args()

    path = Path(args.xlsx)
    if not path.exists():
        print(f"! workbook not found: {path}", file=sys.stderr)
        return 1

    print(f"Reading {path.name} ...")
    xl = pd.ExcelFile(path)
    q_df = xl.parse("NQR Qualifications")
    p_df = xl.parse("District SC Profiles")
    r_df = xl.parse("PM-AJAY Rules")
    s_df = xl.parse("Official Sources")

    print("Connecting to database ...")
    with psycopg.connect(DATABASE_URL, autocommit=False) as conn:
        with conn.cursor() as cur:
            url_by_id = load_sources(cur, s_df)
            rules = load_rules(cur, r_df)
            profiles = load_profiles(cur, p_df)
            live, raw = load_qualifications(cur, q_df, url_by_id)
            # Re-link training centres to the freshly loaded qualifications.
            # (TRUNCATE qualifications CASCADE wiped centre_qualifications.)
            cq_links = relink_centre_qualifications(cur)
        conn.commit()

    print("\n=== Loaded ===")
    print(f"  data_sources            {len(url_by_id)}")
    print(f"  pmajay_rules            {rules}")
    print(f"  district_sc_profiles    {profiles}")
    print(f"  nqr_qualifications_raw  {raw}")
    print(f"  qualifications (active) {live}")
    print(f"  centre_qualifications   {cq_links} (re-linked after corpus refresh)")
    print("\nDone.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
