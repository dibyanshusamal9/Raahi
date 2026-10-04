-- Seed corpus — 20 QPs × 3 districts × ~15 demand rows.
-- Every row has source_url + evidence_date. Values illustrative, sampled
-- from public sources; verify against NCVET/SkillIndia/NCS before production use.
--
-- Safe to re-run: the file replaces its own rows instead of adding copies.
--   * Demand rows are deleted and inserted again.
--   * Courses, centres, schemes and demo users are updated in place, because
--     enrollments, sessions and centre links point at their ids.
-- Needs migrations 0015 (unique training-centre name per district) and 0016
-- (training_centres.sectors).

-- Files are UTF-8; say so explicitly so psql on Windows doesn't read them as WIN1252.
set client_encoding = 'UTF8';

begin;

-- ==== Qualifications ====
insert into qualifications (qp_code, name, sector, nsqf_level, duration_hours, entry_min_class, entry_min_age, mode, self_employment_track, source_url, evidence_date) values
('TEL/Q2100','Mobile Repair Technician (Handset)','Telecom',4, 400, 8, 18, 'classroom', false, 'https://www.ncvet.gov.in/qp/TEL-Q2100','2026-06-15'),
('ELE/Q3104','Domestic Electrician','Electronics',4, 500, 8, 18, 'classroom', true, 'https://www.ncvet.gov.in/qp/ELE-Q3104','2026-06-15'),
('AUT/Q1401','Two-Wheeler Service Technician','Automotive',4, 480, 8, 18, 'on_the_job', false, 'https://www.ncvet.gov.in/qp/AUT-Q1401','2026-06-15'),
('AGR/Q1002','Dairy Farmer / Entrepreneur','Agriculture',4, 350, 5, 18, 'self_employ', true, 'https://www.ncvet.gov.in/qp/AGR-Q1002','2026-06-15'),
('THR/Q0102','Handloom Weaver (Traditional)','Handloom',3, 300, 5, 18, 'self_employ', true, 'https://www.ncvet.gov.in/qp/THR-Q0102','2026-06-15'),
('AMH/Q0301','Assistant Beauty Therapist','Beauty & Wellness',3, 360, 5, 18, 'classroom', true, 'https://www.ncvet.gov.in/qp/AMH-Q0301','2026-06-15'),
('CON/Q0104','Assistant Mason','Construction',3, 200, null, 18, 'on_the_job', false, 'https://www.ncvet.gov.in/qp/CON-Q0104','2026-06-15'),
('RAS/Q0104','Retail Sales Associate','Retail',4, 240, 8, 18, 'classroom', false, 'https://www.ncvet.gov.in/qp/RAS-Q0104','2026-06-15'),
('THR/Q7501','Sewing Machine Operator','Apparel',3, 270, 5, 18, 'classroom', false, 'https://www.ncvet.gov.in/qp/THR-Q7501','2026-06-15'),
('FIC/Q0100','Business Correspondent / Facilitator','BFSI',4, 300, 10, 18, 'classroom', true, 'https://www.ncvet.gov.in/qp/FIC-Q0100','2026-06-15'),
('AGR/Q7601','Poultry Farm Worker','Agriculture',3, 300, 5, 18, 'self_employ', true, 'https://www.ncvet.gov.in/qp/AGR-Q7601','2026-06-15'),
('FSC/Q5001','Field Technician: Home Appliances','Electronics',4, 400, 8, 18, 'classroom', false, 'https://www.ncvet.gov.in/qp/FSC-Q5001','2026-06-15'),
('BSC/Q0107','Junior Software Developer','IT-ITeS',5, 700, 12, 18, 'classroom', false, 'https://www.ncvet.gov.in/qp/BSC-Q0107','2026-06-15'),
('LSC/Q1112','Warehouse Picker','Logistics',3, 200, 8, 18, 'on_the_job', false, 'https://www.ncvet.gov.in/qp/LSC-Q1112','2026-06-15'),
('HSS/Q5101','General Duty Assistant (Healthcare)','Healthcare',4, 460, 10, 18, 'classroom', false, 'https://www.ncvet.gov.in/qp/HSS-Q5101','2026-06-15'),
('TSC/Q2601','Front Office Associate (Hospitality)','Tourism',4, 300, 10, 18, 'classroom', false, 'https://www.ncvet.gov.in/qp/TSC-Q2601','2026-06-15'),
('FIC/Q1102','Micro-enterprise Facilitator','BFSI',4, 240, 8, 18, 'self_employ', true, 'https://www.ncvet.gov.in/qp/FIC-Q1102','2026-06-15'),
('AGR/Q7801','Food Processing — Preserves','Food Processing',3, 300, 5, 18, 'self_employ', true, 'https://www.ncvet.gov.in/qp/AGR-Q7801','2026-06-15'),
('THR/Q0201','Powerloom Weaver','Handloom',3, 320, 5, 18, 'classroom', false, 'https://www.ncvet.gov.in/qp/THR-Q0201','2026-06-15'),
('ASC/Q1401','CNC Operator (Turning)','Manufacturing',4, 600, 10, 18, 'classroom', false, 'https://www.ncvet.gov.in/qp/ASC-Q1401','2026-06-15')
on conflict (qp_code) do update set
    name = excluded.name, sector = excluded.sector, nsqf_level = excluded.nsqf_level,
    duration_hours = excluded.duration_hours, entry_min_class = excluded.entry_min_class,
    entry_min_age = excluded.entry_min_age, mode = excluded.mode,
    self_employment_track = excluded.self_employment_track,
    source_url = excluded.source_url, evidence_date = excluded.evidence_date;

-- ==== Training centres (3 pilot districts) ====
insert into training_centres (name, pia_name, address, district, state, pin, latitude, longitude, source_url, evidence_date, sectors) values
('PMKK Biharsharif','NABET','NH-20, Biharsharif','Nalanda','Bihar','803101', 25.1963, 85.5223, 'https://www.skillindiadigital.gov.in/centre/PMKK-BSH','2026-07-01', array['Telecom','Electronics & HW','Retail','Beauty & Wellness']),
('DDU-GKY Rajgir','Aide et Action','Rajgir Rd','Nalanda','Bihar','803116', 25.0300, 85.4200, 'https://www.skillindiadigital.gov.in/centre/DDU-RAJ','2026-07-01', array['Automotive','Transportation, Logistics & Warehousing','Construction']),
('NIELIT Bihta','NIELIT','Bihta Cantonment','Nalanda','Bihar','801103', 25.5900, 84.8600, 'https://www.skillindiadigital.gov.in/centre/NIELIT-BIH','2026-07-01', array['IT-ITeS','Electronics & HW','BFSI']),
('WSC Bihar Sharif','WSC-Handloom','Weaver Colony','Nalanda','Bihar','803101', 25.2000, 85.5150, 'https://www.skillindiadigital.gov.in/centre/WSC-BSH','2026-07-01', array['Textile & Handloom','Apparel','Handicrafts & Carpets']),
('PMKK Bhagalpur','Rural Skills','Adampur','Bhagalpur','Bihar','812001', 25.2425, 86.9842, 'https://www.skillindiadigital.gov.in/centre/PMKK-BGP','2026-07-01', array['Telecom','Apparel','Beauty & Wellness','Healthcare']),
('Bunkar Kendra Bhagalpur','KVIC','Nathnagar','Bhagalpur','Bihar','812006', 25.2500, 86.9600, 'https://www.skillindiadigital.gov.in/centre/BK-BGP','2026-07-01', array['Textile & Handloom','Handicrafts & Carpets']),
('DDU-GKY Sultanganj','SRLM','Sultanganj Rd','Bhagalpur','Bihar','813213', 25.2500, 86.7300, 'https://www.skillindiadigital.gov.in/centre/DDU-SUL','2026-07-01', array['Retail','Transportation, Logistics & Warehousing','Construction','BFSI']),
('ITI Bhagalpur','Govt ITI','Barari','Bhagalpur','Bihar','812003', 25.2600, 86.9700, 'https://www.skillindiadigital.gov.in/centre/ITI-BGP','2026-07-01', array['Electronics & HW','Capital Goods & Manufacturing','Automotive']),
('PMKK Jhabua','TRIF','Ranapur Rd','Jhabua','Madhya Pradesh','457661', 22.7677, 74.5921, 'https://www.skillindiadigital.gov.in/centre/PMKK-JHB','2026-07-01', array['Telecom','Beauty & Wellness','Apparel','Retail']),
('KVK Jhabua (Agri)','ICAR-KVK','Vari Farm','Jhabua','Madhya Pradesh','457661', 22.7500, 74.6000, 'https://www.skillindiadigital.gov.in/centre/KVK-JHB','2026-07-01', array['Agriculture','Food Industry/Food Processing']),
('DDU-GKY Meghnagar','SRLM','Meghnagar','Jhabua','Madhya Pradesh','457779', 22.9200, 74.6700, 'https://www.skillindiadigital.gov.in/centre/DDU-MEG','2026-07-01', array['Construction','Transportation, Logistics & Warehousing','Healthcare']),
('ITI Jhabua','Govt ITI','College Rd','Jhabua','Madhya Pradesh','457661', 22.7700, 74.5900, 'https://www.skillindiadigital.gov.in/centre/ITI-JHB','2026-07-01', array['Electronics & HW','Automotive','Capital Goods & Manufacturing'])
on conflict (name, district) do update set
    pia_name = excluded.pia_name, address = excluded.address, state = excluded.state,
    pin = excluded.pin, latitude = excluded.latitude, longitude = excluded.longitude,
    source_url = excluded.source_url, evidence_date = excluded.evidence_date,
    sectors = excluded.sectors;

-- ==== Centre × Qualification mapping ====
insert into centre_qualifications (centre_id, qualification_id, next_batch_date, seats_next_batch, documents_required)
select tc.id, q.id,
       (current_date + (10 + (random()*30)::int)) as next_batch,
       25,
       array['Aadhaar','Class certificate','Passport photo']
from training_centres tc
cross join qualifications q
where
    (tc.name = 'PMKK Biharsharif' and q.qp_code in ('TEL/Q2100','ELE/Q3104','RAS/Q0104','AMH/Q0301')) or
    (tc.name = 'DDU-GKY Rajgir'   and q.qp_code in ('AUT/Q1401','LSC/Q1112','CON/Q0104')) or
    (tc.name = 'NIELIT Bihta'     and q.qp_code in ('BSC/Q0107','FSC/Q5001','FIC/Q0100')) or
    (tc.name = 'WSC Bihar Sharif' and q.qp_code in ('THR/Q0102','THR/Q0201','THR/Q7501')) or
    (tc.name = 'PMKK Bhagalpur'   and q.qp_code in ('TEL/Q2100','THR/Q7501','AMH/Q0301','HSS/Q5101')) or
    (tc.name = 'Bunkar Kendra Bhagalpur' and q.qp_code in ('THR/Q0102','THR/Q0201')) or
    (tc.name = 'DDU-GKY Sultanganj' and q.qp_code in ('RAS/Q0104','LSC/Q1112','CON/Q0104','FIC/Q1102')) or
    (tc.name = 'ITI Bhagalpur'    and q.qp_code in ('ELE/Q3104','ASC/Q1401','AUT/Q1401')) or
    (tc.name = 'PMKK Jhabua'      and q.qp_code in ('TEL/Q2100','AMH/Q0301','THR/Q7501','RAS/Q0104')) or
    (tc.name = 'KVK Jhabua (Agri)' and q.qp_code in ('AGR/Q1002','AGR/Q7601','AGR/Q7801')) or
    (tc.name = 'DDU-GKY Meghnagar' and q.qp_code in ('CON/Q0104','LSC/Q1112','HSS/Q5101')) or
    (tc.name = 'ITI Jhabua'       and q.qp_code in ('ELE/Q3104','AUT/Q1401','ASC/Q1401'))
on conflict (centre_id, qualification_id) do update set
    next_batch_date = excluded.next_batch_date,
    seats_next_batch = excluded.seats_next_batch,
    documents_required = excluded.documents_required;

-- ==== Demand signals (NCS 90-day active vacancies, illustrative) ====
-- Deletes the rows this block inserted last time (same district, QP, role and
-- source), then inserts them again.
with seed_jobs (district, state, sector, qp_code, role_title, vacancies_90d, median_wage_inr, source_url, evidence_date) as (values
-- Nalanda
('Nalanda','Bihar','Telecom','TEL/Q2100','Mobile Repair Technician',34, 12000, 'https://www.ncs.gov.in/api/reports/Nalanda-2026-08','2026-08-15'),
('Nalanda','Bihar','Electronics','ELE/Q3104','Domestic Electrician',28, 14000, 'https://www.ncs.gov.in/api/reports/Nalanda-2026-08','2026-08-15'),
('Nalanda','Bihar','Retail','RAS/Q0104','Retail Sales Associate',52, 11500, 'https://www.ncs.gov.in/api/reports/Nalanda-2026-08','2026-08-15'),
('Nalanda','Bihar','Handloom','THR/Q0102','Handloom Weaver',18, 8000, 'https://www.ncs.gov.in/api/reports/Nalanda-2026-08','2026-08-15'),
('Nalanda','Bihar','Beauty & Wellness','AMH/Q0301','Beauty Therapist',22, 9500, 'https://www.ncs.gov.in/api/reports/Nalanda-2026-08','2026-08-15'),
-- Bhagalpur
('Bhagalpur','Bihar','Handloom','THR/Q0102','Handloom Weaver',66, 9500, 'https://www.ncs.gov.in/api/reports/Bhagalpur-2026-08','2026-08-15'),
('Bhagalpur','Bihar','Handloom','THR/Q0201','Powerloom Weaver',41, 11000, 'https://www.ncs.gov.in/api/reports/Bhagalpur-2026-08','2026-08-15'),
('Bhagalpur','Bihar','Apparel','THR/Q7501','Sewing Machine Operator',37, 10500, 'https://www.ncs.gov.in/api/reports/Bhagalpur-2026-08','2026-08-15'),
('Bhagalpur','Bihar','Healthcare','HSS/Q5101','General Duty Assistant',24, 13000, 'https://www.ncs.gov.in/api/reports/Bhagalpur-2026-08','2026-08-15'),
('Bhagalpur','Bihar','Construction','CON/Q0104','Assistant Mason',48, 12500, 'https://www.ncs.gov.in/api/reports/Bhagalpur-2026-08','2026-08-15'),
-- Jhabua
('Jhabua','Madhya Pradesh','Agriculture','AGR/Q1002','Dairy Entrepreneur',31, 9000, 'https://www.ncs.gov.in/api/reports/Jhabua-2026-08','2026-08-15'),
('Jhabua','Madhya Pradesh','Agriculture','AGR/Q7601','Poultry Farm Worker',26, 8500, 'https://www.ncs.gov.in/api/reports/Jhabua-2026-08','2026-08-15'),
('Jhabua','Madhya Pradesh','Construction','CON/Q0104','Assistant Mason',42, 12000, 'https://www.ncs.gov.in/api/reports/Jhabua-2026-08','2026-08-15'),
('Jhabua','Madhya Pradesh','Logistics','LSC/Q1112','Warehouse Picker',19, 11000, 'https://www.ncs.gov.in/api/reports/Jhabua-2026-08','2026-08-15'),
('Jhabua','Madhya Pradesh','Telecom','TEL/Q2100','Mobile Repair Technician',15, 11500, 'https://www.ncs.gov.in/api/reports/Jhabua-2026-08','2026-08-15')
), removed as (
    delete from demand_signals d
     using seed_jobs s
     where d.district = s.district and d.qp_code = s.qp_code
       and d.role_title = s.role_title and d.source_url = s.source_url
       and d.entered_by is null           -- never touch officer-entered openings
)
insert into demand_signals (district, state, sector, qp_code, role_title, vacancies_90d, median_wage_inr, source_url, evidence_date)
select district, state, sector, qp_code, role_title, vacancies_90d, median_wage_inr, source_url, evidence_date::date
from seed_jobs;

-- ==== Schemes ====
insert into schemes (code, name, summary, eligibility, source_url, evidence_date) values
('PM-VISHWAKARMA','PM Vishwakarma','Toolkit + credit + skilling for 18 traditional trades','Traditional artisans; Aadhaar; family occupation','https://pmvishwakarma.gov.in','2026-06-01'),
('NSFDC-EDP','NSFDC Entrepreneurship Development','Loans up to Rs 15L for SC entrepreneurs','SC category; income under 3L rural / 5L urban','https://nsfdc.nic.in/edp','2026-06-01'),
('PMKVY-4','PMKVY 4.0','Short-term skilling with stipend','15-59 yrs; class 5+','https://pmkvy.skillindiadigital.gov.in','2026-07-10')
on conflict (code) do update set
    name = excluded.name, summary = excluded.summary, eligibility = excluded.eligibility,
    source_url = excluded.source_url, evidence_date = excluded.evidence_date;

-- ==== Two demo beneficiaries for dashboard preview ====
insert into beneficiaries (phone_hash, language, home_district, home_state, latitude, longitude, age, gender, social_category, income_bracket, education_class, has_smartphone, interests, aspiration, mobility_km, self_employ_ok, consent_at) values
('demo_sunita_hash','hi','Bhagalpur','Bihar', 25.2500, 86.9600, 32, 'F','SC','under_1L', 5, false, array['weaving','embroidery'], 'income without leaving district', 10, true, now()),
('demo_rohit_hash','hi','Nalanda','Bihar', 25.1963, 85.5223, 24, 'M','SC','under_1L', 10, false, array['phones','repair'], 'city job', 50, false, now())
on conflict (phone_hash) do update set
    language = excluded.language, home_district = excluded.home_district,
    home_state = excluded.home_state, latitude = excluded.latitude,
    longitude = excluded.longitude, age = excluded.age, gender = excluded.gender,
    social_category = excluded.social_category, income_bracket = excluded.income_bracket,
    education_class = excluded.education_class, has_smartphone = excluded.has_smartphone,
    interests = excluded.interests, aspiration = excluded.aspiration,
    mobility_km = excluded.mobility_km, self_employ_ok = excluded.self_employ_ok,
    consent_at = excluded.consent_at, updated_at = now();

commit;
