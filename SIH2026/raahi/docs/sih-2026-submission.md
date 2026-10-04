# 🇮🇳 RAAHI — SIH 2026

> **Smart India Hackathon 2026 Submission**
> A voice-first AI counsellor that helps marginalised rural communities discover government-backed skilling pathways — in their own language, over a phone call.

---

## 📌 Problem Statement

Millions of SC/ST beneficiaries under **PM-AJAY GIA** (Pradhan Mantri Anusuchit Jaati Abhyuday Yojana — Grant-in-Aid) are eligible for free NSQF-certified skilling programmes but never enrol. The barriers are:

- 🔇 **No internet / low literacy** — most cannot navigate online portals
- 🌐 **Language gap** — official information is English-heavy; beneficiaries speak Hindi, Bengali, Tamil, Marathi and regional dialects
- 📋 **Information overload** — 1,947+ active NQR qualifications across 30+ sectors
- 🏫 **Unknown local centres** — training centres exist but beneficiaries don't know about them
- 🤷 **No personalised guidance** — generic pamphlets don't map to individual age, education, district or skill preferences

---

## 💡 Our Solution — RAAHI

**RAAHI (राही) means traveller** — and stands for *Rural AI Advisor for Household Income*. We guide a rural beneficiary to their best skilling pathway using a single phone call.

A beneficiary calls a number → speaks their answers in their own language → receives **three ranked, spoken pathways** with a reason for each — grounded in real NSQF qualifications, real training centres, and real district-level job demand data.

```
📞 Beneficiary calls
       ↓
🗣️  Speaks in Hindi / Bengali / Tamil / Marathi / English
       ↓
🤖  AI extracts profile (age, education, district, interest, mobility)
       ↓
🏆  SQL ranker matches to top-3 NSQF qualifications + nearest centres
       ↓
🔊  Spoken advice delivered back (+ WhatsApp pack sent)
       ↓
🏛️  District officer sees all sessions on dashboard
```

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        INBOUND CHANNELS                          │
│  📞 IVR (Twilio/Exotel)  💬 WhatsApp (Meta)  🌐 Browser Mic     │
└────────────────────────┬─────────────────────────────────────────┘
                         │ audio / text
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│              VOICE PIPELINE  —  FastAPI  :8000                   │
│                                                                  │
│   [STT: Sarvam saaras:v3]                                        │
│         ↓ transcribed text                                       │
│   [Extractor: Groq llama-3.3-70b + Grounding Guard]              │
│         ↓ profile facts (age, class, district, skills, prefs)    │
│   [Next Question Engine]  ←── up to 8 turns, 2-turn stability    │
│         ↓ profile complete                                       │
│   [Ranker: recommend_v4() SQL stored procedure]                  │
│         ↓ top-3 pathways + scores                                │
│   [Composer]  →  builds spoken narrative per pathway             │
│         ↓                                                        │
│   [TTS: Sarvam bulbul:v3]  →  audio sent back to beneficiary     │
│   [Pack sender]            →  WhatsApp / SMS summary pack        │
└──────────────────────────────────────────────────────────────────┘
                         │ reads/writes
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│           DATABASE  —  PostgreSQL / Supabase (Mumbai)            │
│                                                                  │
│  qualifications   training_centres   demand_signals              │
│  sessions         beneficiaries      recommend_pathways          │
│  enrollment_events  transcripts      ingest_bookkeeping          │
└──────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│         OFFICER DASHBOARD  —  Next.js 14  :3000                  │
│   Sessions · Profiles · Recommendations · Explainability trail   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🧩 Repository Layout

```
raahi/
├── apps/
│   ├── voice/                  # Python FastAPI — voice pipeline
│   │   └── app/
│   │       ├── adapters/       # IVR & WhatsApp channel adapters
│   │       │   ├── ivr_twilio.py
│   │       │   ├── ivr_exotel.py
│   │       │   ├── ivr_mock.py
│   │       │   ├── whatsapp_meta.py
│   │       │   └── whatsapp_mock.py
│   │       ├── routers/        # FastAPI route handlers
│   │       │   ├── session.py  # Core session state machine
│   │       │   ├── ivr.py
│   │       │   ├── whatsapp.py
│   │       │   ├── voice.py
│   │       │   ├── admin.py
│   │       │   └── simulator.py
│   │       ├── services/       # All AI / business logic
│   │       │   ├── stt.py            # Speech-to-text (Sarvam)
│   │       │   ├── extractor.py      # LLM extractor + grounding guard
│   │       │   ├── next_question.py  # Adaptive question engine
│   │       │   ├── ranker.py         # Pathway ranker (calls SQL)
│   │       │   ├── composer.py       # Spoken narrative builder
│   │       │   ├── tts.py            # Text-to-speech (Sarvam)
│   │       │   ├── i18n.py           # Translation service
│   │       │   ├── translit.py       # Script transliteration
│   │       │   ├── pack.py           # WhatsApp/SMS pack sender
│   │       │   ├── lifecycle.py      # Enrollment state machine
│   │       │   └── match_explain.py  # Explainability per pathway
│   │       ├── models/         # Pydantic data models
│   │       ├── prompts/        # LLM prompt templates
│   │       ├── main.py         # FastAPI app entry point
│   │       ├── settings.py     # Pydantic settings (reads .env)
│   │       └── db.py           # DB connection pool
│   │
│   ├── web/                    # Next.js 14 — Officer Dashboard
│   │   ├── app/                # App Router pages (sign-in, overview, districts, jobs)
│   │   ├── components/         # UI and chart components
│   │   └── lib/                # API client, helpers
│   │
│   └── caller-site/            # Next.js 16 — RAAHI caller website and web call
│
├── db/
│   ├── migrations/             # 14 SQL migrations (schema evolution)
│   │   ├── 0001_init.sql
│   │   ├── 0002_recommend_pathways.sql
│   │   ├── 0004_ranker_diversity.sql
│   │   ├── 0007_recommend_v4.sql   # Current ranker stored proc
│   │   ├── 0011_indian_districts.sql
│   │   └── 0014_official_dataset.sql
│   ├── seed/
│   │   └── seed.sql            # 20 QPs × 3 pilot districts
│   └── supabase_bootstrap.sql  # Supabase-specific side tables
│
├── data/raw/
│   └── raahi-official-dataset.xlsx # Official India Data Pack
│
├── ingesters/
│   └── import_official_dataset.py  # Loads 1,947 NQR qualifications
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── architecture-diagram.svg
│   ├── sih-2026-submission.md  # this document
│   └── testing.md
│
├── bootstrap_db.py             # One-shot: migrate + seed
├── docker-compose.yml          # Local Postgres container
├── run.bat                     # Windows launcher (auto-detects mode)
├── stop.bat                    # Kill all dev servers
└── .env.example                # All environment variables documented
```

---

## ⚙️ Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Voice API | **Python 3.11 + FastAPI** | Async, fast, Pydantic-native |
| STT | **Sarvam AI `saaras:v3`** | Best-in-class Indian language ASR |
| TTS | **Sarvam AI `bulbul:v3`** | Natural Indian language voice synthesis |
| Extractor LLM | **Groq `llama-3.3-70b-versatile`** | Free tier, ~250ms, excellent instruction following |
| LLM Fallbacks | Gemini, Sarvam-105b, Mock | Resilience; mock always runs as safety net |
| Ranker | **Pure SQL stored procedure** | Deterministic, auditable, no LLM hallucination |
| Database | **PostgreSQL / Supabase** | ACID, row-level security, Mumbai region |
| Officer Dashboard | **Next.js 14 (App Router)** | SSR, fast, officer sign-in |
| IVR | **Twilio / Exotel / Mock** | Production-ready Indian telecom adapters |
| WhatsApp | **Meta WABA / Mock** | WhatsApp Business API for pack delivery |
| Deployment | **Docker (local) / Supabase (cloud)** | Single `run.bat` for both modes |

---

## 🤖 AI Pipeline — Deep Dive

### 1. Speech-to-Text
- **Model**: Sarvam `saaras:v3`
- Handles Hindi, Bengali, Tamil, Marathi, English and code-switching
- Raw audio → transcribed text per conversational turn

### 2. Profile Extractor (`extractor.py`)
- LLM extracts structured facts from free-form speech:
  `age`, `education_class`, `home_district`, `sector_interest`, `existing_skills`, `self_employ_preference`, `mobility_radius_km`
- **Grounding Guard**: A sanitizer that strips any field the LLM invented without evidence in what the user actually said. Zero hallucinations pass through to the ranker.

### 3. Next Question Engine (`next_question.py`)
- Information-gain picker — asks whichever missing field most improves ranking quality next
- **Max 8 turns** per session; **stops early** when top-3 pathways are stable for 2 consecutive turns
- Pre-seeded human translations for hi/bn/ta/mr so questions are instant and idiomatic

### 4. Ranker (`ranker.py` + `recommend_v4()` SQL)
The ranker is **100% deterministic SQL** — no LLM, same profile = same result, fully auditable.

**Scoring signals:**

| Signal | Source | Weight |
|---|---|---|
| Aspiration match | Profile `sector_interest` vs QP sector | High |
| Demand score | `demand_signals.vacancies_90d` in beneficiary's district | High |
| Wage score | `demand_signals.median_wage_inr` | Medium |
| Mobility fit | Distance to nearest centre vs `mobility_radius_km` | Medium |
| Skill gap | Existing skills vs QP entry requirements | Medium |
| History bias | Past enrolments in sector | Low |

**Constraints applied:**
- `entry_min_class` and `entry_min_age` hard-filtered against profile
- Rows with `evidence_date > 180 days` auto-excluded from scoring
- **Diversity rule**: max 1 QP per sector in top-3
- **Location fallback**: District → State → National if no local demand data
- **Reach cap**: Centres beyond mobility radius excluded unless no closer option exists

### 5. Composer (`composer.py`)
- Receives exactly the top-3 DB rows (never invents new data)
- Builds a spoken script: *"Here are your three best pathways. First: [QP name] at [centre] in [district]. You matched because [reason]…"*
- Unit-tested: no name is added, dropped, or renamed from ranker output

### 6. TTS + Delivery
- Sarvam `bulbul:v3`, speaker `priya`, pace `0.95` (gentle, clear)
- Audio file served from `/tts/` static mount
- WhatsApp/SMS pack sent with text summary, batch dates, documents required

---

## 🗄️ Database Schema (Key Tables)

```sql
-- Core corpus (sourced from NCVET / SkillIndia / NCS)
qualifications          -- QP code, NSQF level, sector, mode, entry requirements
training_centres        -- Name, PIA, district, lat/lon, active flag
centre_qualifications   -- Which centre offers which QP, next batch date, seats
demand_signals          -- NCS 90-day vacancies + median wage per district+sector

-- Session & beneficiary data
sessions                -- Phone hash, state machine status, language, turns
beneficiaries           -- Extracted profile (age, class, district, prefs)
recommend_pathways      -- Top-3 ranked results per session
transcripts             -- Full STT text + extractor patches per turn

-- Lifecycle & audit
enrollment_events       -- COUNSELLED → ENROLLED → IN_TRAINING → CERTIFIED → PLACED
voice_turns             -- Per-turn: STT text, extractor diff, ranker snapshot
ingest_bookkeeping      -- Source + timestamp for every ingest run
indian_districts        -- All 700+ Indian districts for validation
```

---

## 🔄 Session State Machine

```
GREET → CONSENT ──(no)──→ GOODBYE
             │
           (yes)
             ↓
         INTERVIEW ◄──────────────┐
             │                    │ (repeat up to 8 turns)
             ↓                    │
         RANKING ─────────────────┘
             │ (top-3 stable for 2 turns)
             ↓
         COMPOSE
             ↓
         PACK  (SMS + WhatsApp delivery)
             ↓
         HANDOFF (mobiliser queue)
```

---

## 📥 Data Sources & Honesty Contract

Every row in the corpus carries `source_url` and `evidence_date`.
**Rows older than 180 days are automatically excluded from scoring.**

| Data | Source |
|---|---|
| 1,947 NQR Qualifications | NCVET National Qualifications Register |
| Training Centres | SkillIndia Digital Portal |
| Job Demand (vacancies, wages) | NCS (National Career Service) 90-day reports |
| SC District Profiles | Census of India + PM-AJAY eligibility rules |
| All-India Districts | Official state/district hierarchy |

---

## 🔒 Privacy & Data Residency

| Concern | How we handle it |
|---|---|
| Phone numbers | Stored **only as SHA-256 hash** — never in cleartext |
| Voice audio | Retained **30 days**, then anonymised |
| Right to erase | Beneficiary says *"delete my record"* → full erasure triggered |
| Data residency | **Supabase Mumbai region** (`ap-south-1`) only |
| LLM calls | Only extracted profile facts sent to LLM — no PII (no phone, no name) |

---

## 🚀 Quick Start

### Option A — Local Docker (offline, fastest)

**Prerequisites**: Docker Desktop, Python 3.11, Node 24, pnpm

```bat
rem 1. Enter project directory
cd PROJECT

rem 2. Set up environment
copy .env.example .env
rem Edit .env: fill SARVAM_API_KEY + GROQ_API_KEY, keep local DATABASE_URL

rem 3. Launch everything
run.bat
```

This will:
- Start Postgres in Docker on `:5432`
- Run all 14 migrations + seed corpus
- Launch Voice API on `:8000`
- Launch Officer Dashboard on `:3000`
- Open the dashboard in your browser

---

### Option B — Supabase Cloud (production)

```bat
rem 1. Create a Supabase project in ap-south-1 (Mumbai)
rem 2. Fill .env with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
rem    and the POOLER connection string (port 6543, NOT 5432)

rem 3. Bootstrap the database (migrate + seed)
python bootstrap_db.py

rem 4. Load the official India dataset (1,947 NQR qualifications)
python -m ingesters.import_official_dataset

rem 5. Run
run.bat
```

> ⚠️ **Use the pooler URL** (`aws-0-ap-south-1.pooler.supabase.com:6543`), NOT the direct DB endpoint. The direct `db.<ref>.supabase.co:5432` is IPv6-only and hangs on most Indian ISPs and Windows machines.

---

## 🔑 Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (local Docker or Supabase pooler) |
| `SUPABASE_URL` | Supabase project URL (for dashboard auth) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key (bypasses RLS for backend) |
| `SARVAM_API_KEY` | Sarvam AI key — used for STT + TTS |
| `EXTRACTOR_PROVIDER` | `groq` (recommended) / `gemini` / `sarvam` / `mock` |
| `GROQ_API_KEY` | Groq API key — free at console.groq.com |
| `IVR_PROVIDER` | `mock` / `twilio` / `exotel` |
| `WHATSAPP_PROVIDER` | `mock` / `meta` |
| `INTERVIEW_MAX_TURNS` | Max turns before forcing ranking (default: `8`) |
| `INTERVIEW_STABLE_TURNS` | Stability threshold for early exit (default: `2`) |

Full reference: [`.env.example`](.env.example)

---

## 🆓 Free LLM Options for the Extractor

| Provider | Free tier | Latency | Model |
|---|---|---|---|
| **Groq ⭐** | 14,400 req/day | ~250 ms | `llama-3.3-70b-versatile` |
| **Gemini** | 1,500 req/day | ~600 ms | `gemini-2.0-flash` |
| **Sarvam** | Included with Sarvam API | 4–8 s | `sarvam-105b` |
| **Mock** | Unlimited | Instant | Rule-based fallback |

Groq is the recommended default. The mock provider always runs in parallel as a safety net.
Set `EXTRACTOR_PROVIDER` in `.env` to switch.

---

## 🗺️ Pilot Scope (MVP — FR-01 to FR-10)

| Dimension | Coverage |
|---|---|
| **Districts** | Nalanda (Bihar) · Bhagalpur (Bihar) · Jhabua (MP) |
| **Languages** | Hindi · Bengali · Tamil · Marathi · English |
| **Cohort** | ~30 demo beneficiaries |
| **Officer Dashboard** | 1 district view |
| **Qualifications** | 20 pilot QPs + 1,947 from official NQR dataset |
| **Training Centres** | 12 pilot centres across 3 districts |

**Scaffolded for V1.1 (not wired in MVP):**
- Kiosk PWA mode
- DTMF fallback (feature phones without voice recognition)
- Session resumption (call back and continue from where you left off)
- Weekly automated data ingest

---

## 📊 Explainability Trail (FR-10)

For every recommendation, the Officer Dashboard can render:

1. Beneficiary profile snapshot (frozen at recommendation time)
2. Full ranked list with per-signal scores (aspiration / demand / mobility / gap / history)
3. Which demand rows counted — with `source_url` + `evidence_date`
4. Which centre was chosen — with reason (distance, batch date, capacity)
5. Composer's full spoken transcript

> **The ranking is deterministic.** `recommend_v4(beneficiary_id)` is a pure SQL function. No LLM. Identical profile → identical output. Every recommendation is fully auditable.

---

## 📈 Enrollment Lifecycle

```
COUNSELLED → ENROLLED → IN_TRAINING → CERTIFIED → PLACED
                  └──────────────────────────────► DROPPED (at any point)
```

Automated nudges fire at **Day 2, Day 7, Day 30** for any state that hasn't advanced.
Every transition is timestamped and written to `enrollment_events`.

---

## 🧪 Testing

```bat
rem Voice API tests
cd apps\voice
pytest tests\ -v
```

See [`testing.md`](testing.md) for the complete test matrix including session simulation, ranker unit tests, extractor grounding-guard tests, and IVR adapter mocks.

---

## 👥 Team

**SIH 2026 — Team Raahi**
GitHub: [Nidhish01/Livelihood-Setu](https://github.com/Nidhish01/Livelihood-Setu)

---

## 📄 License & Data Notice

Built for Smart India Hackathon 2026. All data sources are cited with `source_url` and `evidence_date`.
Values in the seed corpus are illustrative — verify against NCVET / SkillIndia / NCS before production use.
