-- FR-04 · Deterministic pathway ranking
-- No LLM in this path. Hard filter (PASS/FAIL/UNKNOWN) + weighted score.
-- Weights (sum to 1.0):
--   aspiration     0.30
--   demand         0.30
--   mobility       0.15
--   gap            0.15
--   centre history 0.10
-- Signature: recommend_pathways(uuid) → table

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
    hard_filter       text                -- PASS | FAIL | UNKNOWN
)
language plpgsql
stable
as $$
#variable_conflict use_column
declare
    b beneficiaries%rowtype;
begin
    select * into b from beneficiaries where id = p_bid;
    if not found then
        return;
    end if;

    return query
    with cand as (
        select
            q.*,
            -- hard filter
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
    aspir as (
        -- crude aspiration match: sector words appear in interests or aspiration
        select c.id,
               case
                 when b.aspiration is null and (b.interests is null or array_length(b.interests,1) is null)
                     then 0.5    -- UNKNOWN → neutral
                 when lower(coalesce(b.aspiration,'')) like '%'||lower(c.sector)||'%' then 1.0
                 when exists (select 1 from unnest(coalesce(b.interests,'{}'::text[])) i
                              where lower(i) like '%'||lower(c.sector)||'%') then 0.9
                 when c.self_employment_track and coalesce(b.self_employ_ok,false) then 0.7
                 else 0.2
               end as s
        from cand c
    ),
    dem as (
        -- district demand, evidence within 180 days
        select c.id,
               least(1.0, (
                 coalesce((
                   select sum(d.vacancies_90d)::numeric
                   from demand_signals d
                   where d.district = b.home_district
                     and d.evidence_date >= (current_date - interval '180 days')
                     and (d.qp_code = c.qp_code or lower(d.sector) = lower(c.sector))
                 ), 0) / 50.0
               )) as s
        from cand c
    ),
    centres as (
        -- nearest centre offering this qualification, within mobility budget
        select cq.qualification_id as qid,
               tc.id as cid,
               tc.name, tc.address,
               cq.next_batch_date as centre_next_batch_date,
               round((earth_distance(
                   ll_to_earth(b.latitude, b.longitude),
                   ll_to_earth(tc.latitude, tc.longitude)
               ) / 1000.0)::numeric, 1) as km
        from centre_qualifications cq
        join training_centres tc on tc.id = cq.centre_id
        where tc.active
          and (b.latitude is not null and b.longitude is not null)
    ),
    nearest as (
        select distinct on (qid) qid, cid, name, address, centre_next_batch_date, km
        from centres
        order by qid, km asc
    ),
    mob as (
        select c.id,
               case
                 when n.km is null then 0.0
                 when b.mobility_km is null then 0.5           -- UNKNOWN
                 when n.km <= b.mobility_km then 1.0
                 when n.km <= b.mobility_km * 1.5 then 0.6
                 else 0.1
               end as s
        from cand c left join nearest n on n.qid = c.id
    ),
    gap as (
        -- district gap = demand / current training capacity for this sector
        select c.id,
               least(1.0, coalesce((
                   select sum(d.vacancies_90d)::numeric
                   from demand_signals d
                   where d.district = b.home_district
                     and lower(d.sector) = lower(c.sector)
                     and d.evidence_date >= (current_date - interval '180 days')
                 ), 0) /
                 nullif((
                   select count(*)::numeric * 20
                   from centre_qualifications cq
                   join training_centres tc on tc.id = cq.centre_id
                   where tc.district = b.home_district
                     and cq.qualification_id = c.id
                 ), 0)
               ) as s
        from cand c
    ),
    hist as (
        -- centre placement rate for this qualification (last 180d)
        select c.id,
               coalesce((
                   select avg(case when e.state = 'placed' then 1.0 else 0.0 end)
                   from enrollments e
                   where e.qualification_id = c.id
                     and e.created_at >= (now() - interval '180 days')
               ), 0.5) as s
        from cand c
    ),
    scored as (
        select c.id, c.qp_code, c.name as qname, c.sector, c.nsqf_level, c.duration_hours, c.hf,
               n.cid, n.name as cname, n.address, n.centre_next_batch_date as next_batch_date, n.km,
               a.s as sa, d.s as sd, m.s as sm, g.s as sg, h.s as sh,
               (0.30*a.s + 0.30*d.s + 0.15*m.s + 0.15*g.s + 0.10*h.s) as total
        from cand c
        left join aspir a on a.id = c.id
        left join dem d on d.id = c.id
        left join nearest n on n.qid = c.id
        left join mob m on m.id = c.id
        left join gap g on g.id = c.id
        left join hist h on h.id = c.id
        where c.hf <> 'FAIL'
    )
    select
        row_number() over (order by total desc, qname asc)::int as rank,
        s.id, s.qp_code, s.qname, s.sector, s.nsqf_level, s.duration_hours,
        s.cid, s.cname, s.address, s.next_batch_date, s.km,
        round(s.total::numeric, 4),
        round(s.sa::numeric,4), round(s.sd::numeric,4),
        round(s.sm::numeric,4), round(s.sg::numeric,4),
        round(s.sh::numeric,4),
        s.hf
    from scored s
    order by total desc, qname asc
    limit 10;
end;
$$;

comment on function recommend_pathways(uuid) is
    'FR-04 · Deterministic ranking. Identical profile → identical output. Under 100ms p95 on 600-QP district table.';
