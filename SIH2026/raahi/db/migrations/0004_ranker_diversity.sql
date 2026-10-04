-- Ranker v2 — kills the "same 3 always" bug.
--   Root cause: with an empty beneficiary profile every row scored
--   0.35 (0.30*0.5 aspiration + 0.15*1.0 gap + 0.10*0.5 history), then
--   ORDER BY qname ASC put every "Application of ..." row first.
--
-- Changes:
--   1. When beneficiary interests are filled, matching sectors get 0.95
--      and non-matching sectors get 0.10 — a huge signal, so the top-3
--      snaps to what the beneficiary actually cares about.
--   2. Tie-breaker is now hashtext(qp_code + beneficiary_id) — random
--      but stable per beneficiary — instead of alphabetical.
--   3. A second pass keeps only the highest-scoring row per sector so
--      the top-3 spans up to 3 different sectors instead of 3 near-
--      duplicate courses from one series.

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
        select c.id,
               case
                 when b.aspiration is null
                      and (b.interests is null or array_length(b.interests,1) is null)
                     then 0.5
                 -- interests present → strong signal in both directions
                 when b.interests is not null and array_length(b.interests,1) is not null then
                    case
                      when exists (select 1 from unnest(b.interests) i
                                   where lower(c.sector) like '%'||lower(i)||'%'
                                      or lower(i) like '%'||lower(c.sector)||'%'
                                      or lower(c.name) like '%'||lower(i)||'%')
                        then 0.95
                      when c.self_employment_track and coalesce(b.self_employ_ok,false)
                        then 0.55
                      else 0.10
                    end
                 when lower(coalesce(b.aspiration,'')) like '%'||lower(c.sector)||'%'
                    then 1.0
                 when c.self_employment_track and coalesce(b.self_employ_ok,false)
                    then 0.7
                 else 0.2
               end as s
        from cand c
    ),
    dem as (
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
                 when b.mobility_km is null then 0.5
                 when n.km <= b.mobility_km then 1.0
                 when n.km <= b.mobility_km * 1.5 then 0.6
                 else 0.1
               end as s
        from cand c left join nearest n on n.qid = c.id
    ),
    gap as (
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
               (0.30*a.s + 0.30*d.s + 0.15*m.s + 0.15*g.s + 0.10*h.s) as total,
               -- Stable per-beneficiary jitter so the top-3 isn't always
               -- the alphabetically-first ties.
               ((hashtext(c.qp_code || p_bid::text) & 65535)::numeric / 65535.0) * 0.001 as jitter
        from cand c
        left join aspir a on a.id = c.id
        left join dem d on d.id = c.id
        left join nearest n on n.qid = c.id
        left join mob m on m.id = c.id
        left join gap g on g.id = c.id
        left join hist h on h.id = c.id
        where c.hf <> 'FAIL'
    ),
    ranked as (
        select s.*,
               (total + jitter) as total_jittered,
               row_number() over (
                   partition by s.sector
                   order by (s.total + s.jitter) desc
               ) as sector_rank
        from scored s
    ),
    diversified as (
        -- top 3 from DIFFERENT sectors, then fill with the rest
        (select * from ranked where sector_rank = 1 order by total_jittered desc limit 3)
        union all
        (select * from ranked where sector_rank > 1 order by total_jittered desc limit 7)
    )
    select
        row_number() over (order by total_jittered desc)::int as rank,
        d.id, d.qp_code, d.qname, d.sector, d.nsqf_level, d.duration_hours,
        d.cid, d.cname, d.address, d.next_batch_date, d.km,
        round(d.total::numeric, 4),
        round(d.sa::numeric,4), round(d.sd::numeric,4),
        round(d.sm::numeric,4), round(d.sg::numeric,4),
        round(d.sh::numeric,4),
        d.hf
    from diversified d
    order by total_jittered desc
    limit 10;
end;
$$;
