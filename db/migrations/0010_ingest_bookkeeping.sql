-- Bookkeeping tables for the weekly web scraper (ingesters/web).
-- Ported from the standalone livelihood-setu-ingest Prisma schema so the
-- scraper lives in-repo, in our stack, writing to our own tables. Idempotent.

-- Rows the normalizer rejected — kept for human review, never silently dropped.
create table if not exists ingest_quarantine (
    id          uuid primary key default gen_random_uuid(),
    source      text not null,               -- 'nsqf' | 'ncs'
    reason      text not null,
    raw         jsonb,
    reviewed    boolean not null default false,
    created_at  timestamptz not null default now()
);
create index if not exists ingest_quarantine_source_idx on ingest_quarantine(source, reviewed);

-- One row per scraper run — a cheap health check ("NSQF last synced 2 days
-- ago, 612 seen, 3 quarantined") for the officer dashboard.
create table if not exists ingest_runs (
    id               uuid primary key default gen_random_uuid(),
    source           text not null,          -- 'nsqf' | 'ncs'
    rows_seen        int not null default 0,
    rows_written     int not null default 0,
    rows_quarantined int not null default 0,
    duration_ms      int,
    error            text,
    ran_at           timestamptz not null default now()
);
create index if not exists ingest_runs_source_idx on ingest_runs(source, ran_at desc);
