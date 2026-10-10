-- ============================================================
--  Supabase SQL Editor does NOT support \i include directives,
--  so paste the migration/seed files one at a time in this order:
--
--    1. db/migrations/0001_init.sql
--    2. db/migrations/0002_recommend_pathways.sql
--    3. db/migrations/0003_lifecycle_triggers.sql
--    4. The 3 CREATE TABLE statements below (side tables for
--       the NIELIT NSQF extract).
--    5. db/seed/seed.sql
--    6. db/seed/seed_nsqf_expansion.sql
--
--  Then, from your terminal:
--    python bootstrap_db.py            (creates any missing tables above)
--    python -m ingesters.import_nsqf_extracted   (loads 167 NIELIT rows)
-- ============================================================

alter table if exists beneficiaries add column if not exists name text;

create table if not exists qualification_eligibility (
    id            uuid primary key default gen_random_uuid(),
    qp_code       text not null references qualifications(qp_code) on delete cascade,
    option_no     int,
    education     text,
    experience    text,
    notes         text
);
create index if not exists qualification_eligibility_qp_idx
    on qualification_eligibility(qp_code);

create table if not exists qualification_pathways (
    id            uuid primary key default gen_random_uuid(),
    qp_code       text not null references qualifications(qp_code) on delete cascade,
    pathway_text  text
);
create index if not exists qualification_pathways_qp_idx
    on qualification_pathways(qp_code);

create table if not exists qualification_modules (
    id            uuid primary key default gen_random_uuid(),
    qp_code       text not null references qualifications(qp_code) on delete cascade,
    seq           int,
    title         text,
    nos_code      text,
    module_type   text,
    hours         numeric,
    credits       numeric
);
create index if not exists qualification_modules_qp_idx
    on qualification_modules(qp_code);
