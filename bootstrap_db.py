"""One-shot DB bootstrap — works for local Docker OR Supabase.

Reads DATABASE_URL from .env, then runs every file in db/migrations/
and db/seed/ in order. Idempotent: safe to re-run.

For Supabase, make sure DATABASE_URL uses the pooler URL:
    postgresql://postgres.<ref>:<URL-encoded-pw>@aws-0-ap-south-1.pooler.supabase.com:6543/postgres

Usage:
    python bootstrap_db.py           # runs migrations + seed
    python bootstrap_db.py --seed-only
    python bootstrap_db.py --migrations-only
"""
from __future__ import annotations
import os
import sys
import pathlib
import argparse

import psycopg
from dotenv import load_dotenv

ROOT = pathlib.Path(__file__).parent
load_dotenv(ROOT / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("! DATABASE_URL not set in .env", file=sys.stderr)
    sys.exit(1)


MIGRATION_FILES = sorted((ROOT / "db" / "migrations").glob("*.sql"))
BOOTSTRAP_FILE  = ROOT / "db" / "supabase_bootstrap.sql"
SEED_FILES      = [ROOT / "db" / "seed" / "seed.sql",
                   ROOT / "db" / "seed" / "seed_nsqf_expansion.sql",
                   ROOT / "db" / "seed" / "seed_demand_all_india.sql",
                   ROOT / "db" / "seed" / "seed_training_centres.sql"]


def run_sql(cur, path: pathlib.Path) -> None:
    if not path.exists():
        print(f"  skip (missing): {path.name}")
        return
    sql = path.read_text(encoding="utf-8")
    # strip any \i lines — Supabase pooler doesn't run them
    sql = "\n".join(l for l in sql.splitlines() if not l.strip().startswith("\\i"))
    print(f"  -> {path.relative_to(ROOT)}")
    try:
        cur.execute(sql)
    except psycopg.errors.DuplicateTable as e:
        print(f"     skipped: table already exists ({str(e).splitlines()[0][:60]})")
    except psycopg.errors.DuplicateObject as e:
        print(f"     skipped: object already exists ({str(e).splitlines()[0][:60]})")
    except psycopg.errors.DuplicateFunction as e:
        print(f"     skipped: function already exists ({str(e).splitlines()[0][:60]})")
    except psycopg.errors.UniqueViolation as e:
        print(f"     partial: some rows already present ({str(e).splitlines()[0][:60]})")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed-only", action="store_true")
    ap.add_argument("--migrations-only", action="store_true")
    args = ap.parse_args()

    kind = "Supabase" if "supabase.com" in DATABASE_URL else "Postgres"
    print(f"Connecting to {kind}...")
    try:
        conn = psycopg.connect(DATABASE_URL, autocommit=True, connect_timeout=15)
    except Exception as e:
        print(f"! Could not connect: {e}", file=sys.stderr)
        if "getaddrinfo" in str(e).lower() or "unable to resolve" in str(e).lower():
            print(
                "\n  HINT — this is the common Supabase IPv6-only DNS issue.\n"
                "  Use the pooler URL instead of db.<ref>.supabase.co:5432:\n"
                "    postgresql://postgres.<ref>:<URL-encoded-pw>"
                "@aws-0-ap-south-1.pooler.supabase.com:6543/postgres\n"
                "  Remember: '@' in the password → %40",
                file=sys.stderr,
            )
        return 1

    with conn, conn.cursor() as cur:
        if not args.seed_only:
            print("\n[1/3] Migrations")
            for f in MIGRATION_FILES:
                run_sql(cur, f)
            print("\n[2/3] Supabase bootstrap (side tables + column adds)")
            run_sql(cur, BOOTSTRAP_FILE)

        if not args.migrations_only:
            print("\n[3/3] Seed corpus")
            for f in SEED_FILES:
                run_sql(cur, f)

        # summary
        print("\n=== Row counts ===")
        for tbl in ("beneficiaries", "qualifications", "training_centres",
                    "demand_signals", "qualification_eligibility",
                    "qualification_pathways", "qualification_modules"):
            try:
                cur.execute(f"select count(*) from {tbl}")
                (n,) = cur.fetchone()
                print(f"  {tbl:32s} {n}")
            except Exception as e:
                print(f"  {tbl:32s} — {type(e).__name__}: {str(e)[:80]}")

    print("\nDone. Next: `python -m ingesters.import_official_dataset` to load "
          "the Official India Data Pack (qualifications, PM-AJAY rules, SC "
          "district profiles, sources).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
