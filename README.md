# RAAHI - Rural AI Advisor for Household Income

A voice-first AI counsellor built for **Smart India Hackathon 2026**. A caller
from a rural household phones RAAHI, answers a few questions in their own
language, and hears three NSQF-aligned skilling pathways, ranked against real
job openings in their district. District officers use a dashboard to see
calls, skills and job openings by district and to keep the openings up to date.

## What's in this repository

| Path | What it is |
|---|---|
| [`apps/voice`](apps/voice) | Voice backend (FastAPI): speech-to-text, profile extraction, ranking, spoken replies |
| [`apps/web`](apps/web) | Officer dashboard (Next.js 14): sign-in, overview, districts, job openings, beneficiaries |
| [`apps/caller-site`](apps/caller-site) | Public RAAHI website with the web call (Next.js 16) |
| [`db`](db) | PostgreSQL migrations and seed data |
| [`data/raw`](data/raw) | Official India Data Pack (NQR qualifications and more) |
| [`docs`](docs) | Architecture, the [SIH 2026 submission write-up](docs/sih-2026-submission.md), the [setup guide](docs/setup.md) and the testing guide |
| [`.github/workflows`](.github/workflows) | Re-imports the dataset into the database when the workbook changes |

## Run it locally

You need Python 3.11, Node 24, pnpm and PostgreSQL 16 (or Docker). From the
repository root:

```bash
cp .env.example .env              # add your Sarvam and LLM keys; for a local
                                  # database use the commented localhost:5432/raahi line
docker compose up -d              # PostgreSQL 16 with a database named raahi
python bootstrap_db.py            # tables, ranking functions and seed data
python -m ingesters.import_official_dataset
```

Then start the three apps, each in its own terminal:

```bash
cd apps/voice && pip install -r requirements.txt && python -m uvicorn app.main:app --port 8000
cd apps/web && pnpm install && pnpm dev
cd apps/caller-site && npm install && npx next dev -p 3001
```

| App | Address |
|---|---|
| Caller website | http://localhost:3001 |
| Officer dashboard | http://localhost:3000 (sign in with the `OFFICER_ACCESS_CODE` from `.env`) |
| Voice API docs | http://127.0.0.1:8000/docs |

More detail, including a Supabase setup, is in
[`docs/setup.md`](docs/setup.md).

---

Team RAAHI · Smart India Hackathon 2026
