# ingesters/ — how data gets into the database

There is **one** ingester: the **Official India Data Pack loader**.

> ⚠️ The web scrapers (`ncs_scraper`, `nsqf_scraper`, `run_weekly`) have been
> **deleted**. `data/raw/raahi-official-dataset.xlsx` is now the sole source
> of truth for qualifications.

## import_official_dataset.py

Bulk-loads the Official India Data Pack workbook into Postgres. Run it once
after `bootstrap_db.py`, and again whenever the xlsx is refreshed.

```bash
# Default: looks for data/raw/raahi-official-dataset.xlsx
python -m ingesters.import_official_dataset

# Or specify a custom path
python -m ingesters.import_official_dataset --xlsx "C:/path/to/pack.xlsx"

# Or set env-var (useful in CI/containers)
OFFICIAL_DATASET_XLSX=/data/pack.xlsx python -m ingesters.import_official_dataset
```

### What it loads

| Sheet | Table(s) | Notes |
|-------|----------|-------|
| NQR Qualifications | `qualifications` (active only) + `nqr_qualifications_raw` (all) | 2,814 rows total; 1,947 active |
| District SC Profiles | `district_sc_profiles` | 640 districts, Census-2011 SC/ST demographics |
| PM-AJAY Rules | `pmajay_rules` | 13 eligibility gates |
| Official Sources | `data_sources` | 17 source registry entries |

The loader **truncates `qualifications` and reloads from active NQR rows** on
every run — this ensures the live corpus is always in sync with the workbook.
Related tables (`centre_qualifications`, `qualification_eligibility`, etc.) are
cascade-cleared and should be re-seeded from `db/seed/` afterward if needed.

### How the voice app uses this data

```
data/raw/raahi-official-dataset.xlsx
    └─ import_official_dataset.py  (this ingester)
         └─ qualifications table (Postgres)
              └─ recommend_pathways() SQL function
                   └─ ranker.py  (voice app)
                        └─ session.py → recommendations → beneficiary
```

## Where the data lives

Postgres, database `raahi`. Inspect it directly:

```bash
# List qualification sectors and counts
docker compose exec db psql -U postgres -d raahi -c \
  "select sector, count(*) from qualifications group by 1 order by 2 desc;"

# Record status breakdown
docker compose exec db psql -U postgres -d raahi -c \
  "select record_status, count(*) from qualifications group by 1;"

# PM-AJAY eligibility gates
docker compose exec db psql -U postgres -d raahi -c \
  "select rule_id, rule_name, hard_gate from pmajay_rules;"

# District profiles loaded
docker compose exec db psql -U postgres -d raahi -c \
  "select count(*) from district_sc_profiles;"
```

Schema is defined in `db/migrations/*.sql`. Key tables:
`qualifications`, `nqr_qualifications_raw`, `district_sc_profiles`,
`pmajay_rules`, `data_sources`, `training_centres`, `beneficiaries`,
`sessions`, `voice_turns`, `recommendations`.
