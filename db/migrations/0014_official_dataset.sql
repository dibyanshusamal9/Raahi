-- ============================================================
--  Official India Data Pack (livelihood_setu_official_dataset.xlsx)
--
--  Adds provenance columns to qualifications and creates the reference
--  tables the pack ships: NQR audit rows, PM-AJAY policy rules, Census SC
--  district profiles, and the official source registry. The loader is
--  ingesters/import_official_dataset.py.
-- ============================================================

-- Provenance / lifecycle columns on qualifications (nullable, back-compatible).
alter table qualifications add column if not exists record_status text;
alter table qualifications add column if not exists valid_till    date;
alter table qualifications add column if not exists awarding_body  text;

-- Official source registry (source_id is referenced by every other sheet).
create table if not exists data_sources (
    source_id        text primary key,
    name             text,
    owner            text,
    url              text,
    data_area        text,
    format           text,
    access_method    text,
    bulk_available   text,
    suggested_refresh text,
    included         text,
    notes            text
);

-- PM-AJAY policy rules — deterministic eligibility gates (hard_gate = true
-- means failing it disqualifies; applied by the matcher, never by RAG).
create table if not exists pmajay_rules (
    rule_id          text primary key,
    category         text,
    rule_name        text,
    rule_text        text,
    operator         text,
    threshold_value  numeric,
    threshold_unit   text,
    hard_gate        boolean,
    source_id        text,
    source_section   text
);

-- Census-2011 SC/ST/worker demographics per district (targeting context).
create table if not exists district_sc_profiles (
    census_state_code            text,
    census_district_code         text,
    state_name_2011              text,
    district_name_2011           text,
    households                   bigint,
    total_population             bigint,
    male_population              bigint,
    female_population            bigint,
    age_0_6_population           bigint,
    sc_population                bigint,
    sc_male_population           bigint,
    sc_female_population         bigint,
    st_population                bigint,
    literate_population          bigint,
    illiterate_population        bigint,
    total_workers                bigint,
    main_workers                 bigint,
    main_cultivators             bigint,
    main_agricultural_labourers  bigint,
    main_household_industry_workers bigint,
    main_other_workers           bigint,
    marginal_workers             bigint,
    non_workers                  bigint,
    sc_share_pct                 numeric,
    worker_population_pct        numeric,
    source_id                    text,
    retrieved_at                 timestamptz,
    primary key (census_state_code, census_district_code)
);
create index if not exists district_sc_profiles_name_idx
    on district_sc_profiles (lower(district_name_2011));

-- Full NQR corpus (active + expired) kept for audit / historical comparison;
-- only active rows are promoted into qualifications for live matching.
create table if not exists nqr_qualifications_raw (
    nqr_row_id         bigint primary key,
    title              text,
    qualification_code text,
    sector_name        text,
    nsqf_level_raw     text,
    record_status      text,
    valid_till         date,
    source_id          text,
    retrieved_at       timestamptz,
    data               jsonb
);
