-- ============================================================
--  recommend_pathways v7 — recommend what the caller asked for
--
--  What was wrong in v6 (a caller asking for "mobile repair" in Khordha got
--  a Broadband course, a Construction course and a centre "0.3 km" away in
--  Kalahandi):
--    * Skill words matched as substrings, so "mobile" matched "Automobile".
--    * Generic job words from synonym expansions ("technician") gave every
--      "...Technician" course in every sector a perfect skill score, so local
--      demand and distance decided the result instead of the interest.
--    * "mobile repair" also expanded through the generic synonym "repair"
--      into car and two-wheeler servicing.
--    * skill_synonyms still uses the old seed sector names ("Handloom",
--      "Electronics", "IT"...), so the sector hint never matched the official
--      NQR sectors ("Textile & Handloom", "Electronics & HW", "IT-ITeS"...).
--    * 0012 placed every district it could not geocode on its state's centre
--      point (349 of 770 districts share 38 points), so distances between
--      those districts are meaningless.
--
--    * The "driver" synonym pointed at Logistics; driving courses are
--      Automotive. Instructor-training courses ("... (Craft Instructor)") and
--      Persons-with-Disability variants were offered to every caller.
--
--  v7 skill match (still 40% of the total):
--    * The caller's own words, plus words from the most specific synonym that
--      matched them (weighted by how much of what was said it explains),
--      minus generic job words. A caller word that is just a sector name
--      ("telecom", "construction") means "anything in that sector".
--    * Each word matches course names at a word start, with a light stemmer
--      ("weaving" finds "Weaver"), weighted by rarity (IDF): matching "phone"
--      counts far more than matching "repair". A word in the course name
--      counts fully; one only in job_role counts half.
--    * The sector hint only fills in for courses whose words match weakly.
--  v7 ranking: courses are grouped by how well they match compared with the
--  best match (>= 85%, >= 60%, any real match, the rest). Demand, distance and
--  level order courses within a group but never lift a weaker match above a
--  stronger one.
--  v7 distance: a distance between two districts is used only when neither
--  sits on a shared placeholder point; otherwise it is unknown and not shown.
-- ============================================================

-- ---------- location quality ----------
alter table indian_districts
    add column if not exists approx_location boolean not null default false;

update indian_districts d
   set approx_location = exists (
        select 1 from indian_districts o
         where o.id <> d.id
           and o.latitude = d.latitude
           and o.longitude = d.longitude);


-- ---------- old seed sector names -> official NQR sector names ----------
create table if not exists sector_aliases (
    alias  text not null,
    sector text not null,
    primary key (alias, sector)
);

insert into sector_aliases (alias, sector) values
    ('Electronics',     'Electronics & HW'),
    ('Electronics',     'Power'),
    ('Food Processing', 'Food Industry/Food Processing'),
    ('Handloom',        'Textile & Handloom'),
    ('Handloom',        'Handicrafts & Carpets'),
    ('IT',              'IT-ITeS'),
    ('Logistics',       'Transportation, Logistics & Warehousing'),
    ('Manufacturing',   'Capital Goods & Manufacturing'),
    ('Printing',        'Media & Entertainment'),
    ('Tourism',         'Tourism & Hospitality')
on conflict do nothing;


-- Driving courses are in the NQR "Automotive" sector (7 of 11), not Logistics.
update skill_synonyms set sector = 'Automotive'
 where lower(phrase) = 'driver' and sector = 'Logistics';


-- ---------- helpers ----------
-- Light stemmer for trade words: 'weaving' -> 'weav' (finds 'Weaver'),
-- 'tailoring' -> 'tailor', 'electrician' -> 'electric', 'masonry' -> 'mason'.
-- Never returns fewer than 4 letters; short words are matched whole instead.
create or replace function trade_stem(w text)
returns text
language sql
immutable
as $$
    select case
        when length(regexp_replace(lower(w), '(ing|ers|ery|er|ians|ian|ion|als|al|ry|es|s|y)$', '')) >= 4
            then regexp_replace(lower(w), '(ing|ers|ery|er|ians|ian|ion|als|al|ry|es|s|y)$', '')
        else lower(w)
    end
$$;

-- Regex that finds a caller's word at the start of a word in a course name:
-- a stem prefix for longer words, the whole word for short ones ('car' must
-- not match 'Cardiac').
create or replace function trade_pattern(w text)
returns text
language sql
immutable
as $$
    select case when length(trade_stem(w)) >= 4
                then '\m' || trade_stem(w)
                else '\m' || lower(w) || '\M' end
$$;

-- Like expand_skill_terms(), but when a term matches a specific synonym
-- ('mobile repair'), the generic synonyms inside it ('repair', 'mobile') are
-- dropped, so 'mobile repair' no longer pulls in car and two-wheeler service.
drop function if exists expand_interest_terms(text[]);
create or replace function expand_interest_terms(p_terms text[])
returns table (canonical_skill text, sector text, phrase text)
language sql
stable
as $$
    with m as (
        select lower(t) as term, lower(s.phrase) as phrase, s.canonical_skill, s.sector
          from unnest(coalesce(p_terms, '{}'::text[])) t
          join skill_synonyms s
            on lower(t) like '%' || lower(s.phrase) || '%'
            or lower(s.phrase) like '%' || lower(t) || '%'
    )
    select distinct m1.canonical_skill, m1.sector, m1.phrase
      from m m1
     where not exists (
            select 1 from m m2
             where m2.term = m1.term
               and m2.phrase <> m1.phrase
               and m2.phrase like '%' || m1.phrase || '%'
               and m1.term like '%' || m2.phrase || '%')
$$;


-- ============================================================
--  recommend_pathways v7
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
    b               beneficiaries%rowtype;
    has_geo         boolean;
    v_caller_approx boolean;
    v_terms         text[];
    v_has_skill     boolean;
    v_sector_vocab  text[];     -- every word that appears in a sector name
    v_raw           text[];     -- the caller's own distinctive words
    v_specific      boolean;    -- the caller named a trade, not just a sector
    v_canon         text[];     -- canonical skills of the matched synonyms
    v_canon_sector  text[];
    v_canon_weight  numeric[];  -- how much of what the caller said each explains
    v_sectors       text[];     -- sectors the caller's words point to (all names)
    v_words         text[];     -- distinctive words, for the keyword search
    v_patterns      text[];     -- word-start regex per word some course name has
    v_wts           numeric[];  -- weight per pattern: rarity x source
    v_norm          numeric;    -- weight that counts as a full word match
    v_query         tsquery;
    v_reach_cap     numeric;
    -- Job-title words that say nothing about the trade, and filler words
    -- callers use ("mai mobile repair karna chahta hu").
    c_generic constant text[] := array[
        'technician','operator','assistant','associate','executive','worker',
        'helper','trainee','junior','senior','supervisor','manager','engineer',
        'specialist','professional','expert','general','basic','advance',
        'advanced','level','service','maintenance','work','job','field',
        'management','training','course','skill','centre','center','national',
        'certificate','small','unit','sector','industry','the','and','for',
        'with','from','karna','chahta','chahti','chahte','mujhe','mai','main',
        'hai','hoon','kaam','aur','wala','wali','like','want'];
begin
    select * into b from beneficiaries where id = p_bid;
    if not found then
        return;
    end if;

    has_geo := (b.latitude is not null and b.longitude is not null);
    select coalesce(bool_or(d.approx_location), false) into v_caller_approx
      from indian_districts d where lower(d.district) = lower(b.home_district);

    -- Reachability cap: 1.5x stated mobility (min 15 km), else 60 km.
    v_reach_cap := case
        when b.mobility_km is not null and b.mobility_km > 0
            then greatest(b.mobility_km * 1.5, 15)
        else 60
    end;

    -- ---------- what the caller said ----------
    -- ONLY interests. `aspiration` is a location preference ("close to home").
    v_terms := coalesce(b.interests, '{}'::text[]);
    v_has_skill := coalesce(array_length(v_terms, 1), 0) > 0;

    select coalesce(array_agg(distinct w), '{}') into v_sector_vocab
      from (select lower(regexp_split_to_table(x.s, '[[:space:][:punct:]]+')) as w
              from (select distinct q.sector as s from qualifications q
                    union select distinct ss.sector from skill_synonyms ss
                    union select a.alias from sector_aliases a) x) y
     where length(w) >= 3;

    -- The caller's own words, minus generic words and bare sector names
    -- ('telecom', 'construction'): those say which sector, not which trade.
    select coalesce(array_agg(distinct w), '{}') into v_raw
      from (select lower(regexp_split_to_table(t, '[[:space:][:punct:]]+')) as w
              from unnest(v_terms) t) x
     where length(w) >= 3
       and w <> all (c_generic) and trade_stem(w) <> all (c_generic)
       and w <> all (v_sector_vocab);
    v_specific := coalesce(array_length(v_raw, 1), 0) > 0;

    -- Synonyms that matched, each weighted by how much of what the caller
    -- said it explains: for "phones" + "repair" the mobile-repair synonym
    -- explains both words, car servicing (matched only via "repair") one.
    select coalesce(array_agg(e.canonical_skill), '{}'),
           coalesce(array_agg(e.sector), '{}'),
           coalesce(array_agg(
               case when not v_specific then 1.0
                    else greatest(0.25,
                        (select count(*) from unnest(v_raw) r
                          where (e.phrase || ' ' || e.canonical_skill) ~* trade_pattern(r))::numeric
                        / array_length(v_raw, 1))
               end), '{}')
      into v_canon, v_canon_sector, v_canon_weight
      from expand_interest_terms(v_terms) e;

    -- Sectors: those of the best-explaining synonyms, sectors the caller
    -- named outright, and the official names of old synonym sectors.
    select coalesce(array_agg(distinct z.s), '{}') into v_sectors
      from (select v_canon_sector[i] as s
              from generate_subscripts(v_canon_sector, 1) i
             where v_canon_sector[i] is not null
               and v_canon_weight[i] >= (select max(w) from unnest(v_canon_weight) w)
            union
            select q.sector
              from (select distinct sector from qualifications) q
             where exists (
                    select 1 from unnest(v_terms) t,
                           regexp_split_to_table(lower(t), '[[:space:][:punct:]]+') tw
                     where length(tw) >= 3 and tw <> all (c_generic)
                       and tw = any (regexp_split_to_array(lower(q.sector), '[[:space:][:punct:]]+')))) z;
    v_sectors := v_sectors || coalesce(
        (select array_agg(distinct a.sector) from sector_aliases a where a.alias = any(v_sectors)),
        '{}'::text[]);

    -- Distinctive words with their weights. The caller's own words count
    -- fully; synonym words count 0.6 x how much that synonym explains. Rare
    -- words (IDF over course names) count more than common ones.
    with src as (
        select r as word, 1.0::numeric as factor from unnest(v_raw) r
        union all
        select lower(w), 0.6 * v_canon_weight[i]
          from generate_subscripts(v_canon, 1) i,
               regexp_split_to_table(v_canon[i], '[[:space:][:punct:]]+') w
    ),
    kept as (
        -- (Sector names are dropped from the caller's own words above, but a
        -- synonym word like 'beauty' still finds 'Beautician'.)
        select trade_pattern(s.word) as pattern, min(s.word) as word, max(s.factor) as factor
          from src s
         where length(s.word) >= 3
           and s.word <> all (c_generic) and trade_stem(s.word) <> all (c_generic)
         group by trade_pattern(s.word)
    ),
    df as (
        select k.*,
               (select count(*) from qualifications q
                 where not q.short_course
                   and (q.name || ' ' || coalesce(q.job_role, '')) ~* k.pattern) as n
          from kept k
    )
    select coalesce(array_agg(df.word), '{}'),
           coalesce(array_agg(df.pattern) filter (where df.n > 0), '{}'),
           coalesce(array_agg(df.factor * ln(
               ((select count(*) from qualifications where not short_course) + 1.0) / (df.n + 1.0)))
               filter (where df.n > 0), '{}')
      into v_words, v_patterns, v_wts
      from df;

    -- A full word match = the strongest word plus half the next one, so a
    -- course naming the core trade ("Tailor") scores high on its own.
    select coalesce(max(w) filter (where rn = 1), 0) + 0.5 * coalesce(max(w) filter (where rn = 2), 0)
      into v_norm
      from (select w, row_number() over (order by w desc) as rn from unnest(v_wts) w) t;

    v_query := websearch_to_tsquery('simple', nullif(array_to_string(
        case when v_specific then v_words else v_terms end, ' or '), ''));

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
        where not q.short_course                       -- job roles only
          -- Adapted versions of other courses for callers with a disability;
          -- the call doesn't ask about disability, so don't offer them blind.
          and q.sector is distinct from 'Persons with Disability'
          -- Courses that train instructors, not trainees.
          and q.name !~* 'craft instructor'
    ),
    -- ---------- 0.40 skill match (v7) ----------
    words as (
        select c.id,
               -- A word in the course name counts fully; one found only in
               -- job_role (often a long list of occupations) counts half.
               least(1.0, coalesce(
                   (select sum(case when c.name ~* w.pattern then w.wt else 0.5 * w.wt end)
                      from unnest(v_patterns, v_wts) as w(pattern, wt)
                     where (c.name || ' ' || coalesce(c.job_role, '')) ~* w.pattern)
                   / nullif(v_norm, 0), 0)) as ws,
               (c.sector = any(v_sectors))::int as in_sector,
               least(1.0, coalesce(ts_rank(c.search_tsv, v_query), 0) * 4) as kw
        from cand c
    ),
    skill as (
        select w.id,
               case
                 when not v_has_skill then 0.45          -- nothing said yet: neutral
                 -- A named trade: the course's own words decide; the sector
                 -- only fills in for courses whose words match weakly.
                 when v_specific then least(1.0,
                        0.85 * w.ws
                      + 0.25 * w.in_sector * (1 - w.ws)
                      + 0.15 * w.kw)
                 -- Only a sector was named: every course in it is a match.
                 else least(1.0, 0.90 * w.in_sector + 0.20 * w.kw)
               end as s
        from words w
    ),
    -- ---------- 0.20 district demand: role first, sector second ----------
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
                 -- own district: always reachable
                 when tc.district = b.home_district then
                   case when has_geo and tc.latitude is not null then
                          round((earth_distance(
                              ll_to_earth(b.latitude, b.longitude),
                              ll_to_earth(tc.latitude, tc.longitude)) / 1000.0)::numeric, 1)
                        else 5.0::numeric end
                 -- another district: only when neither end is a placeholder point
                 when has_geo and tc.latitude is not null and not v_caller_approx
                      and (tc.source_url not like 'synthetic://%'
                           or not coalesce(dc.approx_location, false)) then
                   round((earth_distance(
                       ll_to_earth(b.latitude, b.longitude),
                       ll_to_earth(tc.latitude, tc.longitude)) / 1000.0)::numeric, 1)
                 else null
               end as km,
               -- is the distance real enough to tell the caller?
               (has_geo and tc.latitude is not null and not v_caller_approx
                and (tc.source_url not like 'synthetic://%'
                     or not coalesce(dc.approx_location, false))) as km_known
        from centre_qualifications cq
        join training_centres tc on tc.id = cq.centre_id
        left join indian_districts dc on lower(dc.district) = lower(tc.district)
        where tc.active
    ),
    nearest as (
        -- Within reach, a centre in the caller's own district wins.
        select distinct on (qid) qid, cid, name, address, centre_next_batch_date, km, km_known
        from centres where km is not null and km <= v_reach_cap
        order by qid, (cdistrict is distinct from b.home_district), km asc
    ),
    taught as (select distinct qid from centres),
    mob as (
        select c.id,
               case
                 when n.km is null and t.qid is null then 0.0  -- no centre teaches it
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
               n.centre_next_batch_date as next_batch_date,
               case when n.km_known then n.km end as km_shown,
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
    strength as (
        select d.*,
               (d.total + d.jitter) as tj,
               case
                 when not v_has_skill then 0
                 when d.sa >= greatest(0.35, 0.85 * max(d.sa) over ()) then 0
                 when d.sa >= greatest(0.35, 0.60 * max(d.sa) over ()) then 1
                 when d.sa >= 0.35 then 2
                 else 3
               end as bucket
        from deduped d
    ),
    ranked as (
        -- Rank within sector among courses of the same match strength, so
        -- unrelated courses of a sector can't use up its two slots.
        select s.*,
               row_number() over (partition by s.sector, s.bucket
                                  order by s.tj desc) as sector_rank
        from strength s
    ),
    -- Tier 0: matches what the caller asked for almost as well as the best
    --         match does (>= 85%), at most two per sector.
    -- Tier 1: a good match (>= 60% of the best).
    -- Tier 2: still a real match (skill >= 0.35).
    -- Tier 3: everything else, only to backfill.
    -- Within a tier, demand, distance and level decide; across tiers they
    -- never lift a weaker match above a stronger one.
    tiered as (
        select r.*,
               case
                 when r.bucket = 0 and r.sector_rank <= 2 then 0
                 when r.bucket = 0 then 1
                 else r.bucket
               end as tier
        from ranked r
    )
    select
        row_number() over (order by t.tier, t.tj desc)::int as rank,
        t.id, t.qp_code, t.qname, t.sector, t.nsqf_level, t.duration_hours,
        t.cid, t.cname, t.address, t.next_batch_date, t.km_shown,
        round(t.total::numeric, 4),
        round(t.sa::numeric,4), round(t.sd::numeric,4),
        round(t.sm::numeric,4), round(t.sl::numeric,4), round(t.sh::numeric,4),
        t.hf
    from tiered t
    order by t.tier, t.tj desc
    limit 10;
end;
$$;
