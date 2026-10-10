# Database

Apply in this order against a Supabase project (region `ap-south-1`) or
local Postgres:

    psql "$DATABASE_URL" -f migrations/0001_init.sql
    psql "$DATABASE_URL" -f migrations/0002_recommend_pathways.sql
    psql "$DATABASE_URL" -f migrations/0003_lifecycle_triggers.sql
    psql "$DATABASE_URL" -f seed/seed.sql

Quick smoke test:

    psql "$DATABASE_URL" -c "select rank, qp_code, qualification_name, centre_name, distance_km, total_score, hard_filter from recommend_pathways((select id from beneficiaries where phone_hash='demo_sunita_hash')) limit 3;"

You should see three ranked pathways, all PASS, distances in km.
