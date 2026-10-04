-- FR-08 · Enrollment lifecycle: audit every transition, surface stalled ones.

create or replace function enrollments_set_state_since()
returns trigger language plpgsql as $$
begin
    if tg_op = 'UPDATE' and old.state is distinct from new.state then
        new.state_since := now();
    end if;
    return new;
end;
$$;

create or replace function enrollments_audit()
returns trigger language plpgsql as $$
begin
    if tg_op = 'INSERT' then
        insert into enrollment_events(enrollment_id, from_state, to_state, by_actor, note)
        values (new.id, null, new.state, coalesce(new.owner,'system'), 'created');
    elsif tg_op = 'UPDATE' and old.state is distinct from new.state then
        insert into enrollment_events(enrollment_id, from_state, to_state, by_actor, note)
        values (new.id, old.state, new.state, coalesce(new.owner,'system'), 'transition');
    end if;
    return null;
end;
$$;

drop trigger if exists trg_enrollments_audit on enrollments;
drop trigger if exists trg_enrollments_state_since on enrollments;

create trigger trg_enrollments_state_since
before update on enrollments
for each row execute function enrollments_set_state_since();

create trigger trg_enrollments_audit
after insert or update on enrollments
for each row execute function enrollments_audit();


-- Stalled queue view — powers mobiliser's "new leads" and "day 2/7/30 nudges"
create or replace view stalled_enrollments as
select
    e.id,
    e.beneficiary_id,
    e.state,
    e.owner,
    e.state_since,
    extract(day from now() - e.state_since)::int as days_in_state,
    case
        when e.state = 'counselled'  and now() - e.state_since >= interval '2 days'  then 'nudge_d2'
        when e.state = 'enrolled'    and now() - e.state_since >= interval '7 days'  then 'nudge_d7'
        when e.state = 'in_training' and now() - e.state_since >= interval '30 days' then 'nudge_d30'
        else 'watch'
    end as bucket
from enrollments e
where e.state not in ('placed','dropped','certified');


-- District demand-vs-supply gap (powers FR-09 dashboard tile #1)
create or replace view district_gaps as
select
    d.district,
    d.sector,
    sum(d.vacancies_90d) filter (
        where d.evidence_date >= current_date - interval '180 days'
    ) as demand_90d,
    coalesce((
        select count(*) * 20                              -- rough seats/quarter proxy
        from centre_qualifications cq
        join training_centres tc on tc.id = cq.centre_id
        join qualifications q on q.id = cq.qualification_id
        where tc.district = d.district and lower(q.sector) = lower(d.sector)
    ), 0) as supply_quarter,
    max(d.evidence_date) as last_evidence
from demand_signals d
group by d.district, d.sector;
