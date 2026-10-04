-- ============================================================
--  Local centres, role-level demand, no short courses
--
--  * qualifications.short_course — NQR codes starting NG-/NM- are short
--    add-on courses ("Fundamentals of BIM ...", "First Aid Care"; median 45
--    hours), not job roles. The ranker no longer recommends them. The few
--    NG-/NM- programmes of 300+ hours are full courses and stay in.
--  * training_centres.sectors — which sectors a centre teaches.
--  * link_centre_courses() — each centre offers the courses its district has
--    job openings for (demand_signals), within the centre's sectors. Replaces
--    the importer's old "every centre teaches every course" linking, and
--    clears links that linking left behind.
--  * recommend_pathways v6 — district demand now credits the exact job role
--    far more than its sector, and a centre in the caller's own district is
--    preferred over an equally reachable one elsewhere.
-- ============================================================

alter table qualifications add column if not exists short_course boolean
    generated always as (qp_code ~ '^(NCVET-)?N[GM]-' and coalesce(duration_hours, 0) < 300) stored;

alter table training_centres add column if not exists sectors text[];


create index if not exists centre_qualifications_qid_idx
    on centre_qualifications (qualification_id);


-- (Re)build centre -> course links from the jobs data. Every link to an
-- official NQR course, and every link of a synthetic centre, is rebuilt from
-- scratch; seed.sql's hand-written links to its own (non-NQR) courses are
-- kept. Returns the number of links added.
create or replace function link_centre_courses()
returns integer
language plpgsql
as $$
declare
    n integer;
begin
    delete from centre_qualifications cq
     using training_centres tc, qualifications q
     where tc.id = cq.centre_id
       and q.id = cq.qualification_id
       and (tc.source_url like 'synthetic://%' or q.record_status = 'active');

    insert into centre_qualifications
           (centre_id, qualification_id, next_batch_date, seats_next_batch, documents_required)
    select distinct on (tc.id, q.id)
           tc.id, q.id,
           current_date + 10 + ((hashtext(tc.id::text || q.id::text) & 2147483647) % 30),
           25,
           array['Aadhaar', 'Class certificate', 'Passport photo']
      from training_centres tc
      join demand_signals d on d.district = tc.district
      join qualifications q on q.qp_code = d.qp_code
     where tc.active
       and q.sector = any(tc.sectors)
       and not q.short_course
    on conflict (centre_id, qualification_id) do nothing;

    get diagnostics n = row_count;
    return n;
end;
$$;


-- ============================================================
--  recommend_pathways v6 (v5 in 0013, changes marked "v6")
--
--  Scoring (weights sum to 1.0):
--      0.40  skill match   full-text over name/job_role/sector/keywords,
--                          with the spoken phrase expanded through
--                          skill_synonyms first
--      0.20  district demand  v6: 70% openings for this exact job role
--                          (60+ = full), 30% openings in its sector (150+ = full)
--      0.15  level fit     NSQF level vs the caller's education
--      0.15  reachability  a centre within the caller's reach (v6: 0 when no
--                          centre anywhere teaches the course)
--      0.10  self-employment alignment
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
    v_reach_cap  numeric;
begin
    select * into b from beneficiaries where id = p_bid;
    if not found then
        return;
    end if;

    has_geo := (b.latitude is not null and b.longitude is not null);

    -- Reachability cap: only attach a centre the caller can plausibly
    -- reach. Cap = 1.5x stated mobility (min 15 km), else 60 km.
    v_reach_cap := case
        when b.mobility_km is not null and b.mobility_km > 0
            then greatest(b.mobility_km * 1.5, 15)
        else 60
    end;

    -- ---------- build the search query from what the caller said ----------
    -- ONLY interests. `aspiration` is a location preference ("close to home")
    -- and must never enter the skill query.
    v_terms := coalesce(b.interests, '{}'::text[]);

    select array_agg(distinct e.sector) filter (where e.sector is not null),
           string_agg(distinct e.canonical_skill, ' ')
      into v_sectors, v_skillwords
      from expand_skill_terms(v_terms) e;

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
        where not q.short_course                       -- v6: job roles only
    ),
    -- ---------- 0.40 skill match ----------
    skill as (
        select c.id,
               case
                 when not v_has_skill then 0.45          -- nothing said yet: neutral
                 else least(1.0,
                        coalesce(ts_rank(c.search_tsv, v_query), 0) * 6.0
                      + case when v_sectors is not null and c.sector = any(v_sectors)
                             then 0.60 else 0.0 end
                      + case when exists (
                              select 1 from unnest(v_terms) t
                              where length(t) >= 4
                                and (lower(c.name)              like '%' || lower(t) || '%'
                                  or lower(coalesce(c.job_role,'')) like '%' || lower(t) || '%'))
                             then 0.35 else 0.0 end
                      + case when v_skillwords is not null and exists (
                              select 1 from unnest(string_to_array(v_skillwords,' ')) w
                              where length(w) >= 5
                                and lower(c.name) like '%' || lower(w) || '%')
                             then 0.30 else 0.0 end)
               end as s
        from cand c
    ),
    -- ---------- 0.20 district demand (v6: role first, sector second) ----------
    dem as (
        select c.id,
               0.7 * least(1.0, coalesce(x.role_vac, 0) / 60.0)
             + 0.3 * least(1.0, coalesce(x.sector_vac, 0) / 150.0) as s
        from cand c
        left join lateral (
            select sum(d.vacancies_90d) filter (where d.qp_code = c.qp_code)::numeric as role_vac,
                   sum(d.vacancies_90d)::numeric as sector_vac
            from demand_signals d
            where d.district = b.home_district
              and d.evidence_date >= (current_date - interval '180 days')
              and (d.qp_code = c.qp_code or lower(d.sector) = lower(c.sector))
        ) x on true
    ),
    -- ---------- 0.15 NSQF level fit ----------
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
               tc.id as cid, tc.name, tc.address, tc.district as cdistrict,
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
        -- v6: within reach, a centre in the caller's own district wins.
        -- Some districts share placeholder coordinates, so distance alone can
        -- pick a neighbouring district's centre at "0 km".
        select distinct on (qid) qid, cid, name, address, centre_next_batch_date, km
        from centres where km is not null and km <= v_reach_cap
        order by qid, (cdistrict is distinct from b.home_district), km asc
    ),
    taught as (select distinct qid from centres),
    mob as (
        select c.id,
               case
                 when n.km is null and t.qid is null then 0.0  -- v6: no centre teaches it
                 when n.km is null then 0.25                 -- taught, but out of reach
                 when b.mobility_km is null then 0.7
                 when n.km <= b.mobility_km then 1.0
                 when n.km <= b.mobility_km * 1.5 then 0.6
                 else 0.15
               end as s
        from cand c
        left join nearest n on n.qid = c.id
        left join taught  t on t.qid = c.id
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
    -- Collapse near-duplicate courses (same job role under several QP codes).
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
    -- Tier 0 = genuinely matches the stated interest, at most two per sector.
    -- Tier 1 = everything else, only to backfill.
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
