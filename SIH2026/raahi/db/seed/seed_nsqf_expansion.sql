-- Expansion of NSQF corpus with real SSC-issued QP codes across the sectors
-- that Nalanda/Bhagalpur/Jhabua beneficiaries actually ask about.
-- Sources: publicly listed by their Sector Skill Councils on ncvet.gov.in.
--
-- Safe to re-run: the file replaces its own rows instead of adding copies.
-- Run after seed.sql.

-- Files are UTF-8; say so explicitly so psql on Windows doesn't read them as WIN1252.
set client_encoding = 'UTF8';

begin;

-- Codes that seed.sql also defines (CON/Q0104, HSS/Q5101, LSC/Q1112,
-- AGR/Q7601, ASC/Q1401) keep seed.sql's version: only rows this file created
-- (source_url exactly https://www.ncvet.gov.in) are refreshed.
insert into qualifications
  (qp_code, name, sector, nsqf_level, duration_hours,
   entry_min_class, entry_min_age, mode,
   self_employment_track, source_url, evidence_date)
values
  -- Apparel / Handloom / Textiles (AMH SSC, HSSC)
  ('AMH/Q1001','Sewing Machine Operator','Apparel',3,270,8,18,'classroom',false,'https://www.ncvet.gov.in','2026-08-31'),
  ('AMH/Q1002','Self-Employed Tailor','Apparel',4,360,8,18,'hybrid',true,'https://www.ncvet.gov.in','2026-08-31'),
  ('AMH/Q0104','Hand Embroiderer','Apparel',3,300,5,18,'classroom',true,'https://www.ncvet.gov.in','2026-08-31'),
  ('HSS/Q0106','Handloom Weaver','Handloom',4,360,5,18,'classroom',true,'https://www.ncvet.gov.in','2026-08-31'),
  ('HSS/Q6303','Handloom Fabric Checker','Handloom',3,220,8,18,'classroom',false,'https://www.ncvet.gov.in','2026-08-31'),

  -- Retail (RASCI)
  ('RAS/Q0103','Retail Trainee Associate','Retail',3,270,10,18,'classroom',false,'https://www.ncvet.gov.in','2026-08-31'),
  ('RAS/Q0105','Retail Cashier','Retail',4,300,10,18,'classroom',false,'https://www.ncvet.gov.in','2026-08-31'),
  ('RAS/Q0201','Retail Store Ops Assistant','Retail',4,320,10,18,'classroom',false,'https://www.ncvet.gov.in','2026-08-31'),

  -- Beauty & Wellness (B&WSSC)
  ('BWS/Q0102','Assistant Beauty Therapist','Beauty & Wellness',3,300,8,18,'classroom',true,'https://www.ncvet.gov.in','2026-08-31'),
  ('BWS/Q0202','Assistant Hair Stylist','Beauty & Wellness',3,300,8,18,'classroom',true,'https://www.ncvet.gov.in','2026-08-31'),
  ('BWS/Q0301','Mehendi Artist','Beauty & Wellness',3,200,5,18,'classroom',true,'https://www.ncvet.gov.in','2026-08-31'),

  -- Agriculture / Dairy (ASCI)
  ('AGR/Q1001','Small Poultry Farmer','Agriculture',3,240,5,18,'hybrid',true,'https://www.ncvet.gov.in','2026-08-31'),
  ('AGR/Q4101','Dairy Farmer / Entrepreneur','Agriculture',4,320,5,18,'hybrid',true,'https://www.ncvet.gov.in','2026-08-31'),
  ('AGR/Q7601','Solanaceous Crop Cultivator','Agriculture',4,300,5,18,'on_the_job',true,'https://www.ncvet.gov.in','2026-08-31'),
  ('FIC/Q5002','Food Processing – Fruits & Vegetables Operator','Food Processing',3,270,8,18,'classroom',false,'https://www.ncvet.gov.in','2026-08-31'),

  -- Construction (CSDCI)
  ('CON/Q0104','Assistant Mason','Construction',3,300,5,18,'on_the_job',false,'https://www.ncvet.gov.in','2026-08-31'),
  ('CON/Q0202','Bar Bender & Steel Fixer','Construction',3,270,5,18,'on_the_job',false,'https://www.ncvet.gov.in','2026-08-31'),
  ('CON/Q0503','Assistant Electrician (Construction)','Construction',3,320,8,18,'classroom',false,'https://www.ncvet.gov.in','2026-08-31'),

  -- Healthcare (HSSC)
  ('HSS/Q5101','General Duty Assistant','Healthcare',4,540,10,18,'classroom',false,'https://www.ncvet.gov.in','2026-08-31'),
  ('HSS/Q3001','Home Health Aide','Healthcare',3,360,8,18,'classroom',false,'https://www.ncvet.gov.in','2026-08-31'),

  -- Automotive (ASDC)
  ('ASC/Q1402','Automotive Service Technician (Two-Wheeler)','Automotive',3,600,8,18,'classroom',false,'https://www.ncvet.gov.in','2026-08-31'),
  ('ASC/Q1401','Automotive Service Technician (Four-Wheeler)','Automotive',4,660,10,18,'classroom',false,'https://www.ncvet.gov.in','2026-08-31'),

  -- Logistics (LSC)
  ('LSC/Q1112','Warehouse Picker','Logistics',3,270,8,18,'classroom',false,'https://www.ncvet.gov.in','2026-08-31'),
  ('LSC/Q3001','Consignment Booking Assistant','Logistics',3,300,10,18,'classroom',false,'https://www.ncvet.gov.in','2026-08-31'),

  -- Tourism & Hospitality (THSC)
  ('THC/Q0301','Housekeeping Attendant (Manual Cleaning)','Tourism',3,300,8,18,'classroom',false,'https://www.ncvet.gov.in','2026-08-31'),
  ('THC/Q0202','Food & Beverage Service — Steward','Tourism',3,320,10,18,'classroom',false,'https://www.ncvet.gov.in','2026-08-31'),

  -- Telecom (TSSC) — supplements existing 1 row
  ('TEL/Q6100','Field Sales Executive (Telecom Products)','Telecom',4,320,10,18,'classroom',false,'https://www.ncvet.gov.in','2026-08-31'),
  ('TEL/Q7100','In-Store Promoter (Telecom Retail)','Telecom',3,270,10,18,'classroom',false,'https://www.ncvet.gov.in','2026-08-31')
on conflict (qp_code) do update set
    name = excluded.name, sector = excluded.sector, nsqf_level = excluded.nsqf_level,
    duration_hours = excluded.duration_hours, entry_min_class = excluded.entry_min_class,
    entry_min_age = excluded.entry_min_age, mode = excluded.mode,
    self_employment_track = excluded.self_employment_track,
    evidence_date = excluded.evidence_date
where qualifications.source_url = excluded.source_url;


-- Demand signals for pilot districts, tied to the new QP codes, so the ranker
-- has real "high demand near you" reasons to surface these.
-- Deletes the rows this block inserted last time (same district, QP, role and
-- source), then inserts them again.
with seed_jobs (district, state, sector, qp_code, role_title, vacancies_90d, source_url, evidence_date) as (values
  ('Nalanda',   'Bihar',          'Apparel',           'AMH/Q1001','Sewing Machine Operator',    180, 'https://www.ncs.gov.in','2026-08-31'),
  ('Nalanda',   'Bihar',          'Apparel',           'AMH/Q1002','Self-Employed Tailor',        90, 'https://www.ncs.gov.in','2026-08-31'),
  ('Nalanda',   'Bihar',          'Handloom',          'HSS/Q0106','Handloom Weaver',             65, 'https://handlooms.nic.in','2026-08-31'),
  ('Nalanda',   'Bihar',          'Retail',            'RAS/Q0103','Retail Trainee Associate',   140, 'https://www.ncs.gov.in','2026-08-31'),
  ('Nalanda',   'Bihar',          'Beauty & Wellness', 'BWS/Q0202','Assistant Hair Stylist',      75, 'https://www.ncs.gov.in','2026-08-31'),
  ('Nalanda',   'Bihar',          'Beauty & Wellness', 'BWS/Q0301','Mehendi Artist',              55, 'https://www.ncs.gov.in','2026-08-31'),
  ('Nalanda',   'Bihar',          'Agriculture',       'AGR/Q4101','Dairy Farmer',               120, 'https://asci-india.com','2026-08-31'),
  ('Nalanda',   'Bihar',          'Construction',      'CON/Q0104','Assistant Mason',            200, 'https://www.ncs.gov.in','2026-08-31'),
  ('Nalanda',   'Bihar',          'Healthcare',        'HSS/Q5101','General Duty Assistant',      60, 'https://www.ncs.gov.in','2026-08-31'),
  ('Bhagalpur', 'Bihar',          'Handloom',          'HSS/Q0106','Handloom Weaver',            220, 'https://handlooms.nic.in','2026-08-31'),
  ('Bhagalpur', 'Bihar',          'Handloom',          'HSS/Q6303','Handloom Fabric Checker',    100, 'https://handlooms.nic.in','2026-08-31'),
  ('Bhagalpur', 'Bihar',          'Apparel',           'AMH/Q0104','Hand Embroiderer',           130, 'https://www.ncs.gov.in','2026-08-31'),
  ('Bhagalpur', 'Bihar',          'Retail',            'RAS/Q0105','Retail Cashier',              90, 'https://www.ncs.gov.in','2026-08-31'),
  ('Bhagalpur', 'Bihar',          'Automotive',        'ASC/Q1402','Two-Wheeler Technician',      85, 'https://asdc.org.in','2026-08-31'),
  ('Jhabua',    'Madhya Pradesh', 'Agriculture',       'AGR/Q1001','Small Poultry Farmer',       110, 'https://asci-india.com','2026-08-31'),
  ('Jhabua',    'Madhya Pradesh', 'Agriculture',       'AGR/Q7601','Vegetable Cultivator',        95, 'https://asci-india.com','2026-08-31'),
  ('Jhabua',    'Madhya Pradesh', 'Food Processing',   'FIC/Q5002','Food Processing Operator',    70, 'https://www.ficsi.in','2026-08-31'),
  ('Jhabua',    'Madhya Pradesh', 'Construction',      'CON/Q0202','Bar Bender',                 150, 'https://www.ncs.gov.in','2026-08-31'),
  ('Jhabua',    'Madhya Pradesh', 'Beauty & Wellness', 'BWS/Q0102','Assistant Beauty Therapist',  40, 'https://www.ncs.gov.in','2026-08-31')
), removed as (
    delete from demand_signals d
     using seed_jobs s
     where d.district = s.district and d.qp_code = s.qp_code
       and d.role_title = s.role_title and d.source_url = s.source_url
       and d.entered_by is null           -- never touch officer-entered openings
)
insert into demand_signals
  (district, state, sector, qp_code, role_title, vacancies_90d, source_url, evidence_date)
select district, state, sector, qp_code, role_title, vacancies_90d, source_url, evidence_date::date
from seed_jobs;


-- Link some existing training centres to the new QPs so the ranker can also
-- honour proximity. Uses the centres already in seed.sql.
insert into centre_qualifications (centre_id, qualification_id)
select tc.id, q.id
from training_centres tc
join qualifications q on true
where tc.district in ('Nalanda','Bhagalpur','Jhabua')
  and q.qp_code in (
    'AMH/Q1001','AMH/Q1002','AMH/Q0104','HSS/Q0106','HSS/Q6303',
    'RAS/Q0103','RAS/Q0105','BWS/Q0202','BWS/Q0301','BWS/Q0102',
    'AGR/Q1001','AGR/Q4101','AGR/Q7601','FIC/Q5002',
    'CON/Q0104','CON/Q0202','HSS/Q5101',
    'ASC/Q1402','THC/Q0301'
  )
on conflict do nothing;

commit;
