# RAAHI

Rural AI Advisor for Household Income.

Voice-first AI counsellor for NSQF-aligned skilling under PM-AJAY GIA.
A beneficiary calls a number, speaks their answers in their own language,
and receives three ranked pathways with a spoken reason for each — grounded
in real NSQF qualifications, real training centres, and real district demand data.

Repo: <https://github.com/dibyanshusamal9/Raahi>

## Layout

    apps/
      voice/         Python FastAPI — voice pipeline, IVR/WhatsApp webhooks,
                     STT, LLM extractor, ranker, composer, pack sender
      web/           Next.js 14 (App Router) — officer dashboard
      caller-site/   Next.js 16 — RAAHI caller website and web call
    data/raw/        raahi-official-dataset.xlsx (Official India Data Pack)
    db/
      migrations/    Postgres/Supabase schema (base tables, ranker SQL, triggers)
      seed/          Seed corpus — QPs, centres, district demand
      supabase_bootstrap.sql   Side-table adds specific to Supabase
    ingesters/       NSQF ingest scripts (NIELIT extract loader is the main one)
    docs/            Architecture, SIH 2026 submission write-up, testing guide
    bootstrap_db.py  One-shot migrate + seed against DATABASE_URL
    run.bat          Windows launcher (auto-detects Supabase vs local Docker)
    stop.bat         Kill dev servers + docker

---

## Quickstart — LOCAL DOCKER (fastest, offline)

1. Install Docker Desktop, Python 3.11, Node 24, pnpm.
2. `cp .env.example .env` — keep the local `DATABASE_URL` line
   (`postgresql://postgres:postgres@localhost:5432/raahi`), fill in your
   Sarvam key + your extractor LLM key (Groq recommended, free at
   <https://console.groq.com/keys>).
3. `run.bat` — starts Postgres, seeds the corpus, launches the voice API
   at :8000 and the dashboard at :3000, and opens the dashboard in your
   browser. Two console windows appear (voice, web); close them to stop.

---

## Quickstart — SUPABASE (cloud)

1. **Create a Supabase project** in region **`ap-south-1`** (Mumbai)
   at <https://supabase.com/dashboard>.

2. **Get the pooler connection string** (Supabase → *Project Settings* →
   *Database* → *Connection Pooling* → *Session mode*, port `6543`).
   The string looks like:
   ```
   postgresql://postgres.<PROJECT-REF>:<PASSWORD>@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
   ```
   - **Do NOT use** the direct URL `db.<ref>.supabase.co:5432` — it is
     IPv6-only and hangs from most Indian ISPs / Windows.
   - URL-encode special characters in the password: `@` → `%40`, `:` → `%3A`, `/` → `%2F`.

3. **Fill `.env`** — copy `.env.example` and paste:
   ```
   SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   SUPABASE_ANON_KEY=eyJ...
   DATABASE_URL=postgresql://postgres.YOUR-PROJECT-REF:URL_ENCODED_PW@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
   ```

4. **Create every table + seed it** — one command:
   ```
   python bootstrap_db.py
   ```
   That runs all `db/migrations/*.sql`, the Supabase-specific side-table
   file, and the seed corpus. Idempotent — safe to re-run.

5. **Load the Official India Data Pack** (1,947 active NQR qualifications,
   PM-AJAY rules, Census SC district profiles, source registry):
   ```
   python -m ingesters.import_official_dataset
   ```

6. **Run the app** — `run.bat` (auto-detects Supabase and skips Docker).

That's it. Your voice pipeline now reads/writes Supabase.

---

## Free LLM options for the extractor

Set `EXTRACTOR_PROVIDER` in `.env`:

| Provider | Free tier | Latency | Notes |
|---|---|---|---|
| **groq** ⭐ | 14 400 req/day | ~250 ms | `llama-3.3-70b-versatile`. Get key at <https://console.groq.com/keys> |
| **gemini** | 1 500 req/day | ~600 ms | `gemini-2.0-flash`. Get key at <https://aistudio.google.com/apikey> |
| **sarvam** | included in Sarvam API | 4–8 s | `sarvam-105b` — heavier, occasional hallucinations |
| **grok** | paid only (xAI credit) | ~500 ms | `grok-3-mini`. Free tier removed by xAI |
| **mock** | free | instant | Rule-based fallback. Always runs alongside LLM as safety net |

Groq is the recommended default. Every provider is post-processed by a
grounding-guard sanitizer in `apps/voice/app/services/extractor.py` that
strips any field the LLM invented without evidence in the user's answer.

---

## What ships in MVP (from PRD § 10)

FR-01 → FR-10, three pilot districts (Nalanda, Bhagalpur, Jhabua), four
languages (Hindi, Bengali, Tamil, Marathi) plus English, demo cohort of
~30, officer dashboard for one district. Kiosk PWA, DTMF fallback,
session resumption and weekly ingest are V1.1 (scaffolded, not wired
here).

## Data honesty

No row in `qualifications`, `training_centres` or `demand_signals` is
written without a `source_url` and `evidence_date`. Rows with
`evidence_date` older than 180 days drop out of scoring automatically.
The seed corpus follows the same rule.

## Language & privacy

Phone numbers stored only as SHA-256 hash. Voice audio retained 30 days,
then anonymised. Beneficiary can trigger right-to-erase from the voice
line ("delete my record"). Data residency: Supabase Mumbai region.
