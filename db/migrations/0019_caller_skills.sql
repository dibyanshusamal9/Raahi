-- The skill each caller asked for, in English, for the officer dashboard.
--
-- Callers name skills in their own words and language ("मोबाइल रिपेयर",
-- "phones"). skill_synonyms already maps those words to a canonical skill;
-- skill_labels gives every canonical skill a plain English name and the
-- official sector (qualifications.sector) whose job openings it competes for,
-- so "calls asking for a skill" can be compared with "openings in its sector".

set client_encoding = 'UTF8';   -- the synonyms below are in Indian scripts

create table if not exists skill_labels (
    canonical_skill text primary key,
    label           text not null,
    sector          text not null
);

insert into skill_labels (canonical_skill, label, sector) values
    ('agriculture crop cultivation farmer',            'Farming',             'Agriculture'),
    ('agriculture crop cultivation farmer dairy',      'Farming',             'Agriculture'),
    ('dairy milk cattle livestock',                    'Dairy & livestock',   'Agriculture'),
    ('poultry bird farming',                           'Poultry farming',     'Agriculture'),
    ('embroidery needlework',                          'Embroidery',          'Apparel'),
    ('tailoring sewing garment',                       'Tailoring',           'Apparel'),
    ('tailoring sewing garment apparel',               'Tailoring',           'Apparel'),
    ('automotive mechanic vehicle service',            'Vehicle mechanic',    'Automotive'),
    ('driver commercial vehicle',                      'Driving',             'Automotive'),
    ('four wheeler car service',                       'Car repair',          'Automotive'),
    ('two wheeler motorcycle service',                 'Two-wheeler repair',  'Automotive'),
    ('accounting tally bookkeeping',                   'Accounting',          'BFSI'),
    ('banking financial services',                     'Banking',             'BFSI'),
    ('banking financial services accounting tally',    'Banking',             'BFSI'),
    ('beauty therapist salon cosmetology',             'Beauty & salon',      'Beauty & Wellness'),
    ('beauty therapist salon cosmetology wellness',    'Beauty & salon',      'Beauty & Wellness'),
    ('hair stylist barber',                            'Hair styling',        'Beauty & Wellness'),
    ('makeup artist cosmetology',                      'Makeup artistry',     'Beauty & Wellness'),
    ('mehendi henna art',                              'Mehendi art',         'Beauty & Wellness'),
    ('bar bending steel fixing',                       'Bar bending',         'Construction'),
    ('carpentry woodwork furniture',                   'Carpentry',           'Wood & Carpentry'),
    ('construction mason bricklaying masonry',         'Construction',        'Construction'),
    ('mason bricklaying masonry',                      'Masonry',             'Construction'),
    ('painting surface finishing',                     'Painting',            'Construction'),
    ('plumbing pipe fitting',                          'Plumbing',            'Plumbing'),
    ('welding fabrication',                            'Welding',             'Capital Goods & Manufacturing'),
    ('electrician wiring electrical',                  'Electrical work',     'Power'),
    ('electronics electrician wiring electrical',      'Electronics',         'Electronics & HW'),
    ('solar panel photovoltaic renewable',             'Solar installation',  'Electronics & HW'),
    ('bakery baking confectionery',                    'Bakery',              'Food Industry/Food Processing'),
    ('food processing preservation packaging',         'Food processing',     'Food Industry/Food Processing'),
    ('handloom weaving textile',                       'Weaving',             'Textile & Handloom'),
    ('healthcare general duty assistant',              'Healthcare assistant','Healthcare'),
    ('healthcare nursing patient care attendant',      'Nursing care',        'Healthcare'),
    ('home health aide patient care',                  'Home caregiving',     'Healthcare'),
    ('nursing patient care attendant',                 'Nursing care',        'Healthcare'),
    ('computer basics office productivity',            'Computer skills',     'IT-ITeS'),
    ('computer basics office productivity software',   'Computer skills',     'IT-ITeS'),
    ('data entry typing office',                       'Data entry',          'IT-ITeS'),
    ('programming software development',               'Programming',         'IT-ITeS'),
    ('delivery logistics courier',                     'Delivery',            'Transportation, Logistics & Warehousing'),
    ('warehouse packing logistics',                    'Warehouse work',      'Transportation, Logistics & Warehousing'),
    ('warehouse packing logistics delivery',           'Warehouse work',      'Transportation, Logistics & Warehousing'),
    ('flex printing signage banner vinyl',             'Flex printing',       'Media & Entertainment'),
    ('graphic design dtp coreldraw photoshop',         'Graphic design',      'Media & Entertainment'),
    ('printing press offset digital',                  'Printing',            'Media & Entertainment'),
    ('screen printing textile print',                  'Screen printing',     'Textile & Handloom'),
    ('retail cashier billing',                         'Cashier',             'Retail'),
    ('retail sales store associate',                   'Retail sales',        'Retail'),
    ('mobile phone repair handset technician',         'Mobile repair',       'Telecom'),
    ('mobile phone repair handset technician telecom', 'Mobile repair',       'Telecom'),
    ('food beverage cook kitchen',                     'Cooking',             'Tourism & Hospitality'),
    ('hospitality housekeeping food beverage',         'Hospitality',         'Tourism & Hospitality'),
    ('hospitality housekeeping front office',          'Hotel housekeeping',  'Tourism & Hospitality')
on conflict (canonical_skill) do update
    set label = excluded.label, sector = excluded.sector;

-- Words callers used that matched no skill ("phones", Assamese "খেতি বাড়ি"),
-- plus the same two everyday skills in more of the supported languages.
insert into skill_synonyms (phrase, lang, canonical_skill, sector) values
    ('phone',      'en', 'mobile phone repair handset technician', 'Telecom'),
    ('फोन',        'hi', 'mobile phone repair handset technician', 'Telecom'),
    ('फ़ोन',        'hi', 'mobile phone repair handset technician', 'Telecom'),
    ('मोबाइल',      'hi', 'mobile phone repair handset technician', 'Telecom'),
    ('মোবাইল',      'bn', 'mobile phone repair handset technician', 'Telecom'),
    ('ମୋବାଇଲ',      'or', 'mobile phone repair handset technician', 'Telecom'),
    ('ਮੋਬਾਈਲ',      'pa', 'mobile phone repair handset technician', 'Telecom'),
    ('મોબાઇલ',      'gu', 'mobile phone repair handset technician', 'Telecom'),
    ('খেতি',        'as', 'agriculture crop cultivation farmer',    'Agriculture'),
    ('চাষ',         'bn', 'agriculture crop cultivation farmer',    'Agriculture'),
    ('ଚାଷ',         'or', 'agriculture crop cultivation farmer',    'Agriculture'),
    ('ਖੇਤੀ',        'pa', 'agriculture crop cultivation farmer',    'Agriculture'),
    ('ખેતી',        'gu', 'agriculture crop cultivation farmer',    'Agriculture'),
    ('వ్యవసాయం',    'te', 'agriculture crop cultivation farmer',    'Agriculture'),
    ('ಕೃಷಿ',        'kn', 'agriculture crop cultivation farmer',    'Agriculture'),
    ('കൃഷി',        'ml', 'agriculture crop cultivation farmer',    'Agriculture')
on conflict do nothing;

-- The skill named by the first of a caller's interests that matches one.
create or replace function caller_skill(p_interests text[])
returns table (label text, sector text)
language sql
stable
as $$
    select coalesce(l.label, initcap(e.canonical_skill)),
           coalesce(l.sector,
                    (select a.sector from sector_aliases a where a.alias = e.sector limit 1),
                    e.sector)
      from unnest(coalesce(p_interests, '{}'::text[])) with ordinality as t(term, ord)
      cross join lateral expand_interest_terms(array[t.term]) e
      left join skill_labels l on l.canonical_skill = e.canonical_skill
     order by t.ord, length(e.phrase) desc
     limit 1
$$;

-- One row per caller who named a skill: the skill in English, its sector, and
-- how many calls they made. An interest that matches no known skill is shown
-- as typed if it is already English; otherwise the sector of the course RAAHI
-- recommended stands in for it. Callers who named nothing have no row.
create or replace view caller_skills as
select b.id            as beneficiary_id,
       b.home_district as district,
       b.home_state    as state,
       coalesce(m.label,
                case when b.interests[1] !~ '[^\x01-\x7f]' then initcap(b.interests[1]) end,
                r.sector) as skill,
       coalesce(m.sector, r.sector) as sector,
       (select count(*) from sessions s where s.beneficiary_id = b.id)::int as calls
  from beneficiaries b
  left join lateral caller_skill(b.interests) m on true
  left join lateral (
        select rec.top3 -> 0 ->> 'sector' as sector
          from recommendations rec
         where rec.beneficiary_id = b.id
         order by rec.created_at desc
         limit 1) r on true
 where coalesce(array_length(b.interests, 1), 0) > 0;
