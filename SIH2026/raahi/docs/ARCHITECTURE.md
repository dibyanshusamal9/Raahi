# Architecture

## One picture

    ┌──────────────┐    audio    ┌───────────────┐
    │ IVR / WhatsApp│ ─────────► │  Voice API    │
    │  (adapters)  │             │  (FastAPI)    │
    └──────────────┘             │               │
                                 │  ┌─────────┐  │
                                 │  │  STT    │  │  Sarvam Saaras → Whisper fallback
                                 │  └────┬────┘  │
                                 │       ▼       │
                                 │  ┌─────────┐  │
                                 │  │Extractor│  │  LLM → Pydantic (Zod-equivalent)
                                 │  └────┬────┘  │
                                 │       ▼       │
                                 │  ┌─────────┐  │
                                 │  │NextQ    │  │  info-gain picker
                                 │  └────┬────┘  │
                                 │       ▼       │
                                 │  ┌─────────┐  │
                                 │  │ Ranker  │──┼──► recommend_pathways() SQL
                                 │  └────┬────┘  │       (Supabase Postgres)
                                 │       ▼       │
                                 │  ┌─────────┐  │
                                 │  │Composer │  │  Sarvam-M reads top-3
                                 │  └────┬────┘  │
                                 │       ▼       │
                                 │  ┌─────────┐  │
                                 │  │  TTS    │  │
                                 │  └────┬────┘  │
                                 └───────┼───────┘
                                         │ audio + SMS + WhatsApp pack
                                         ▼
                                    beneficiary
                                    ┌────────────────┐
                                    │ Officer web    │  Next.js — dashboard, leads,
                                    │ (Next.js)      │  explainability drill-down
                                    └────────────────┘

## Contract that keeps every layer honest

- **Ranking is deterministic.** `recommend_pathways(beneficiary_id)` is a
  pure SQL function. No LLM. Identical profile → identical output.
- **Every reference row has a source.** `qualifications`,
  `training_centres`, `demand_signals` all carry `source_url` +
  `evidence_date`. Rows past 180 days drop out of scoring.
- **The composer never invents.** It receives the top-3 rows and their
  scores; it only paraphrases. Unit tests assert no name is added,
  dropped or renamed.
- **Every voice turn is traceable.** `voice_turns` stitches STT text,
  extractor patch, ranker snapshot, composer output — one `session_id`.

## Session state machine

    caller ──dial──► GREET
                       │
                       ▼
                   CONSENT ──no──► GOODBYE
                       │yes
                       ▼
                   INTERVIEW ◄──┐
                       │        │ (up to 8 turns; ends when top-3 stable
                       ▼        │  for 2 consecutive turns)
                   RANKING──────┘
                       │
                       ▼
                   COMPOSE
                       │
                       ▼
                    PACK (SMS + WhatsApp)
                       │
                       ▼
                   HANDOFF (mobiliser queue)

## Enrollment lifecycle (FR-08)

COUNSELLED → ENROLLED → IN_TRAINING → CERTIFIED → PLACED
                    └──────────► DROPPED (any point)

Nudges fire at day 2, 7, 30 for a state that hasn't advanced.
Every transition is timestamped and written to `enrollment_events`.

## Explainability trail (FR-10)

For any recommendation, the dashboard can render:

1. Beneficiary profile snapshot (frozen at recommendation time)
2. Full ranked list with per-signal scores (aspiration/demand/mobility/gap/history)
3. Which demand rows counted — with source_url + evidence_date
4. Which centre was chosen — with why (distance, batch, capacity)
5. The composer's transcript
