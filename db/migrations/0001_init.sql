-- Livelihood Setu — initial schema
-- Every reference table carries source_url + evidence_date. No exceptions.

create extension if not exists "pgcrypto";
create extension if not exists "cube";
create extension if not exists "earthdistance";

-- =====================================================================
-- Reference: NSQF qualifications (source: NCVET registry)
-- =====================================================================
create table qualifications (
    id              uuid primary key default gen_random_uuid(),
    qp_code         text unique not null,        -- e.g. "TEL/Q2100"
    name            text not null,
    sector          text not null,               -- e.g. "Telecom", "Handloom"
    nsqf_level      int  not null check (nsqf_level between 1 and 8),
    duration_hours  int  not null,
    entry_min_class int,                          -- e.g. 5, 8, 10
    entry_min_age   int  not null default 18,
    entry_max_age   int,
    mode            text not null check (mode in ('classroom','on_the_job','hybrid','self_employ')),
    self_employment_track boolean not null default false,
    source_url      text not null,
    evidence_date   date not null,
    created_at      timestamptz not null default now()
);
create index on qualifications (sector);
create index on qualifications (nsqf_level);

-- =====================================================================
-- Reference: Training centres (source: Skill India Digital + state SRLM)
-- =====================================================================
create table training_centres (
    id              uuid primary key default gen_random_uuid(),
    name            text not null,
    pia_name        text,                         -- Project Implementing Agency
    address         text not null,
    district        text not null,
    state           text not null,
    pin             text,
    latitude        double precision not null,
    longitude       double precision not null,
    active          boolean not null default true,
    source_url      text not null,
    evidence_date   date not null,
    created_at      timestamptz not null default now()
);
create index on training_centres (district);
create index on training_centres using gist (ll_to_earth(latitude, longitude));

-- Which qualifications a centre delivers, with next batch date
create table centre_qualifications (
    centre_id       uuid references training_centres(id) on delete cascade,
    qualification_id uuid references qualifications(id) on delete cascade,
    next_batch_date date,
    seats_next_batch int,
    documents_required text[],
    primary key (centre_id, qualification_id)
);

-- =====================================================================
-- Reference: Demand signals (source: National Career Service, 90-day active)
-- =====================================================================
create table demand_signals (
    id              uuid primary key default gen_random_uuid(),
    district        text not null,
    state           text not null,
    sector          text not null,
    qp_code         text,                          -- optional link to a QP
    role_title      text not null,                 -- e.g. "Mobile Repair Technician"
    vacancies_90d   int  not null,
    median_wage_inr int,
    source_url      text not null,
    evidence_date   date not null,
    created_at      timestamptz not null default now()
);
create index on demand_signals (district, sector);

-- =====================================================================
-- Beneficiary (voice sessions)
-- =====================================================================
create table beneficiaries (
    id              uuid primary key default gen_random_uuid(),
    phone_hash      text unique not null,         -- SHA-256, never plaintext
    language        text not null,                -- ISO code, e.g. "hi", "bn"
    home_district   text,
    home_state      text,
    latitude        double precision,             -- district-precision only
    longitude       double precision,
    age             int,
    gender          text,
    social_category text,                          -- SC / ST / OBC / GEN — gates GIA
    income_bracket  text,                          -- gates GIA
    is_minor        boolean generated always as (age is not null and age < 18) stored,
    -- profile answers
    education_class int,
    literacy        text,                          -- self-reported
    has_smartphone  boolean,
    interests       text[],                        -- free-form interests
    prior_trade     text,
    aspiration      text,                          -- "want city job" / "stay near home" / ...
    mobility_km     int,                           -- how far willing to travel
    self_employ_ok  boolean,
    consent_at      timestamptz,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index on beneficiaries (home_district);

-- =====================================================================
-- Voice sessions (one call/WhatsApp thread = one session)
-- =====================================================================
create type session_transport as enum ('ivr','whatsapp','kiosk');
create type session_status    as enum ('active','completed','abandoned','erased');

create table sessions (
    id              uuid primary key default gen_random_uuid(),
    beneficiary_id  uuid references beneficiaries(id) on delete cascade,
    transport       session_transport not null,
    status          session_status not null default 'active',
    turn_count      int not null default 0,
    last_top3       jsonb,                         -- for stability check
    stable_streak   int not null default 0,
    started_at      timestamptz not null default now(),
    ended_at        timestamptz,
    audio_url       text                           -- IVR recording, if any
);
create index on sessions (beneficiary_id);

create table voice_turns (
    id              uuid primary key default gen_random_uuid(),
    session_id      uuid references sessions(id) on delete cascade,
    turn_no         int not null,
    asked           text,                          -- system's spoken question
    heard_text      text,                          -- STT output
    stt_provider    text,                          -- "sarvam" | "whisper" | "dtmf"
    stt_confidence  numeric,
    extractor_patch jsonb,                         -- field diff applied
    audio_url       text,
    latency_ms      int,
    created_at      timestamptz not null default now(),
    unique (session_id, turn_no)
);

-- =====================================================================
-- Enrollments (lifecycle — FR-08)
-- =====================================================================
create type enrollment_state as enum
    ('counselled','enrolled','in_training','certified','placed','dropped');

create table enrollments (
    id              uuid primary key default gen_random_uuid(),
    beneficiary_id  uuid references beneficiaries(id) on delete cascade,
    qualification_id uuid references qualifications(id),
    centre_id       uuid references training_centres(id),
    state           enrollment_state not null default 'counselled',
    state_since     timestamptz not null default now(),
    owner           text,                          -- mobiliser username / "system"
    employer        text,
    role_placed     text,
    wage_band       text,
    created_at      timestamptz not null default now()
);
create index on enrollments (state, state_since);
create index on enrollments (beneficiary_id);

create table enrollment_events (
    id              uuid primary key default gen_random_uuid(),
    enrollment_id   uuid references enrollments(id) on delete cascade,
    from_state      enrollment_state,
    to_state        enrollment_state not null,
    at              timestamptz not null default now(),
    by_actor        text not null,
    note            text
);

-- =====================================================================
-- Recommendations (frozen snapshot — for explainability FR-10)
-- =====================================================================
create table recommendations (
    id              uuid primary key default gen_random_uuid(),
    session_id      uuid references sessions(id) on delete cascade,
    beneficiary_id  uuid references beneficiaries(id) on delete cascade,
    profile_snapshot jsonb not null,               -- exact profile at rec time
    top3            jsonb not null,                -- ranked qualifications + centres + scores
    signals_used    jsonb not null,                -- which demand rows, which centre history
    composer_text   text,
    created_at      timestamptz not null default now()
);
create index on recommendations (beneficiary_id);

-- =====================================================================
-- Schemes (kept from Yojana Setu — mySchema scraper output)
-- =====================================================================
create table schemes (
    id              uuid primary key default gen_random_uuid(),
    code            text unique not null,          -- "PM-VISHWAKARMA", "NSFDC-EDP"
    name            text not null,
    summary         text,
    eligibility     text,
    source_url      text not null,
    evidence_date   date not null
);

-- =====================================================================
-- Audit
-- =====================================================================
create table audit_log (
    id              bigserial primary key,
    at              timestamptz not null default now(),
    actor           text not null,
    action          text not null,
    subject_table   text,
    subject_id      uuid,
    payload         jsonb
);
