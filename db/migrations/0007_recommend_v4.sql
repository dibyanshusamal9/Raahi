-- ============================================================
--  recommend_pathways v4 — real skill matching
--
--  What was wrong in v3:
--    * Matching was `sector LIKE '%interest%'`. A beneficiary saying
--      "flex" or "mobile repair" matched no sector, so every row tied
--      and the corpus's sheer volume decided the answer — 89% of the
--      377 rows are NIELIT IT/Electronics, so IT always won.
--    * job_role and the 226 learning-module titles were never searched.
--    * NSQF level was only a hard filter, never a fit score, so a
--      class-8 caller and a graduate got the same ordering.
--
--  v4 scoring (weights sum to 1.0):
--      0.40  skill match   full-text over name/job_role/sector/keywords,
--                          with the spoken phrase expanded through
--                          skill_synonyms first
--      0.20  district demand
--      0.15  level fit     NSQF level vs the caller's education
--      0.15  reachability  a centre in the district / within mobility
--      0.10  self-employment alignment
--
--  Plus: at most ONE row per sector in the top 3, so a single
--  over-represented sector cannot occupy every slot.
-- ============================================================

drop function if exists recommend_pathways(uuid);

create or replace function recommend_pathways(p_bid uuid)
returns table (
    rank              int,
    qualification_id  uuid,
    qp_code           text,
    qualification_name text,
    sector            text,
    nsqf_level        int,
    duration_hours    int,
    centre_id         uuid,
    centre_name       text,
    centre_address    text,
    next_batch_date   date,
    distance_km       numeric,
    total_score       numeric,
    score_aspiration  numeric,
    score_demand      numeric,
    score_mobility    numeric,
    score_gap         numeric,
    score_history     numeric,
    hard_filter       text
)
language plpgsql
stable
as $$
#variable_conflict use_column
declare
    b            beneficiaries%rowtype;
    has_geo      boolean;
    v_terms      text[];
    v_query      tsquery;
    v_skillwords text;
    v_sectors    text[];
    v_has_skill  boolean;
begin
    select * into b from beneficiaries where id = p_bid;
    if not found then
        return;
    end if;

    has_geo := (b.latitude is not null and b.longitude is not null);

    -- ---------- build the search query from what the caller said ----------
    -- ONLY interests. `aspiration` is a location preference ("close to home",
    -- "in the city") and must never enter the skill query: the word "home"
    -- matches things like "Field Technician: Home Appliances" and poisons
    -- every result. Location is handled by the reachability score instead.
    v_terms := coalesce(b.interests, '{}'::text[]);

    select array_agg(distinct e.sector) filter (where e.sector is not null),
           string_agg(distinct e.canonical_skill, ' ')
      into v_sectors, v_skillwords
      from expand_skill_terms(v_terms) e;

    -- Turn the expanded skill words PLUS the raw spoken terms (so a phrase
    -- with no synonym row still searches) into an OR-ed tsquery.
    -- websearch_to_tsquery tolerates punctuation and never raises on odd input.
    v_query := websearch_to_tsquery('simple',
        nullif(trim(
            coalesce(replace(v_skillwords, ' ', ' or '), '')
            || case when array_length(v_terms, 1) > 0
                    then ' or ' || array_to_string(v_terms, ' or ')
                    else '' end
        ), '')
    );
    v_has_skill := (v_query is not null and v_query::text <> '');

    return query
    with cand as (
        select
            q.*,
            case
                when b.age is null then 'UNKNOWN'
                when b.age < q.entry_min_age then 'FAIL'
                when q.entry_max_age is not null and b.age > q.entry_max_age then 'FAIL'
                when q.entry_min_class is not null and b.education_class is not null
                     and b.education_class < q.entry_min_class then 'FAIL'
                else 'PASS'
            end as hf
        from qualifications q
    ),
    -- ---------- 0.40 skill match ----------
    skill as (
        select c.id,
               case
                 when not v_has_skill then 0.45          -- nothing said yet: neutral
                 else least(1.0,
                        -- Full-text relevance. ts_rank returns small values;
                        -- x6 (not x12) so a single incidental token match does
                        -- NOT saturate the score to 1.0.
                        coalesce(ts_rank(c.search_tsv, v_query), 0) * 6.0
                        -- Sector hint from the synonym table: the strongest and
                        -- most reliable signal we have.
                      + case when v_sectors is not null and c.sector = any(v_sectors)
                             then 0.60 else 0.0 end
                        -- Direct substring hit on the course name or job role.
                      + case when exists (
                              select 1 from unnest(v_terms) t
                              where length(t) >= 4
                                and (lower(c.name)              like '%' || lower(t) || '%'
                                  or lower(coalesce(c.job_role,'')) like '%' || lower(t) || '%'))
                             then 0.35 else 0.0 end
                        -- Hit on an expanded canonical skill word inside the
                        -- course name (e.g. 'sewing' -> 'Sewing Machine Operator')
                      + case when v_skillwords is not null and exists (
                              select 1 from unnest(string_to_array(v_skillwords,' ')) w
                              where length(w) >= 5
                                and lower(c.name) like '%' || lower(w) || '%')
                             then 0.30 else 0.0 end)
               end as s
        from cand c
    ),
    -- ---------- 0.20 district demand ----------
    dem as (
        select c.id,
               least(1.0, coalesce((
                   select sum(d.vacancies_90d)::numeric
                   from demand_signals d
                   where d.district = b.home_district
                     and d.evidence_date >= (current_date - interval '180 days')
                     and (d.qp_code = c.qp_code or lower(d.sector) = lower(c.sector))
               ), 0) / 150.0) as s
        from cand c
    ),
    -- ---------- 0.15 NSQF level fit ----------
    -- A class-8 caller should not be pointed at an NSQF-6 specialist course,
    -- and a graduate should not be parked on NSQF-2. Score peaks at the
    -- level that matches their schooling and falls off either side.
    lvl as (
        select c.id,
               case
                 when b.education_class is null then 0.5
                 else greatest(0.05,
                        1.0 - (abs(c.nsqf_level - (
                            case
                              when b.education_class >= 15 then 6   -- graduate
                              when b.education_class >= 13 then 5   -- diploma
                              when b.education_class >= 12 then 4   -- 12th
                              when b.education_class >= 10 then 4   -- 10th
                              when b.education_class >= 8  then 3   -- 8th
                              else 2
                            end
                        ))::numeric * 0.28))
               end as s
        from cand c
    ),
    -- ---------- 0.15 reachability ----------
    centres as (
        select cq.qualification_id as qid,
               tc.id as cid, tc.name, tc.address,
               cq.next_batch_date as centre_next_batch_date,
               case
                 when has_geo and tc.latitude is not null then
                   round((earth_distance(
                       ll_to_earth(b.latitude, b.longitude),
                       ll_to_earth(tc.latitude, tc.longitude)) / 1000.0)::numeric, 1)
                 when tc.district = b.home_district then 5.0::numeric
                 when b.home_state is not null and tc.state = b.home_state then 50.0::numeric
                 else null
               end as km
        from centre_qualifications cq
        join training_centres tc on tc.id = cq.centre_id
        where tc.active
    ),
    nearest as (
        select distinct on (qid) qid, cid, name, address, centre_next_batch_date, km
        from centres where km is not null order by qid, km asc
    ),
    mob as (
        select c.id,
               case
                 when n.km is null then 0.25                 -- no centre known
                 when b.mobility_km is null then 0.7
                 when n.km <= b.mobility_km then 1.0
                 when n.km <= b.mobility_km * 1.5 then 0.6
                 else 0.15
               end as s
        from cand c left join nearest n on n.qid = c.id
    ),
    -- ---------- 0.10 self-employment alignment ----------
    selfemp as (
        select c.id,
               case
                 when b.self_employ_ok is null then 0.5
                 when b.self_employ_ok and c.self_employment_track then 1.0
                 when b.self_employ_ok and not c.self_employment_track then 0.35
                 when not b.self_employ_ok and not c.self_employment_track then 0.8
                 else 0.4
               end as s
        from cand c
    ),
    scored as (
        select c.id, c.qp_code, c.name as qname, c.sector, c.nsqf_level, c.duration_hours, c.hf,
               n.cid, n.name as cname, n.address,
               n.centre_next_batch_date as next_batch_date, n.km,
               sk.s as sa, d.s as sd, m.s as sm, l.s as sl, se.s as sh,
               (0.40*sk.s + 0.20*d.s + 0.15*l.s + 0.15*m.s + 0.10*se.s) as total,
               ((hashtext(c.qp_code || p_bid::text) & 65535)::numeric / 65535.0) * 0.0005 as jitter
        from cand c
        join skill   sk on sk.id = c.id
        join dem     d  on d.id  = c.id
        join lvl     l  on l.id  = c.id
        join mob     m  on m.id  = c.id
        join selfemp se on se.id = c.id
        left join nearest n on n.qid = c.id
        where c.hf <> 'FAIL'
    ),
    -- Collapse near-duplicate courses. The corpus contains the same job role
    -- under more than one QP code (e.g. THR/Q7501 and AMH/Q1001 are both
    -- "Sewing Machine Operator"); showing both looks like a bug to the caller.
    deduped as (
        select distinct on (lower(btrim(s.qname))) s.*
        from scored s
        order by lower(btrim(s.qname)), (s.total + s.jitter) desc
    ),
    ranked as (
        select d.*,
               (d.total + d.jitter) as tj,
               row_number() over (partition by d.sector
                                  order by (d.total + d.jitter) desc) as sector_rank
        from deduped d
    ),
    -- Two tiers. Tier 0 = genuinely matches the stated interest, at most two
    -- per sector so one sector can't take every slot. Tier 1 = everything
    -- else, used only to backfill when tier 0 has fewer than three rows
    -- (e.g. an interest that matches only one course in the whole corpus).
    tiered as (
        select r.*,
               case
                 when (not v_has_skill or r.sa >= 0.35) and r.sector_rank <= 2
                   then 0 else 1
               end as tier
        from ranked r
    )
    select
        row_number() over (order by t.tier, t.tj desc)::int as rank,
        t.id, t.qp_code, t.qname, t.sector, t.nsqf_level, t.duration_hours,
        t.cid, t.cname, t.address, t.next_batch_date, t.km,
        round(t.total::numeric, 4),
        round(t.sa::numeric,4), round(t.sd::numeric,4),
        round(t.sm::numeric,4), round(t.sl::numeric,4), round(t.sh::numeric,4),
        t.hf
    from tiered t
    order by t.tier, t.tj desc
    limit 10;
end;
$$;
