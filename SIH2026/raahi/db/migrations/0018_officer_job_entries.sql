-- Job openings entered by district officers through the officer site
-- (POST /officer/jobs) instead of SQL.
--   entered_by   the officer's name; set only on officer-entered rows, which
--                are the only rows the officer site lets people edit or delete,
--                and the rows the seed files never delete
--   source_note  free-text source, e.g. the employer or "Rozgar Mela, 3 Oct"
alter table demand_signals add column if not exists entered_by text;
alter table demand_signals add column if not exists source_note text;
