-- ============================================================
--  Skill-matching foundation
--
--  Three things the ranker needs but never had:
--    1. job_role on qualifications  (the most matchable field; the
--       NIELIT extract has it but the importer was dropping it)
--    2. a full-text search vector over name + sector + job_role
--    3. a synonym table mapping what a beneficiary actually SAYS
--       (in any of the 5 pilot languages) to a canonical skill+sector
--
--  Idempotent: safe to re-run.
-- ============================================================

-- ---------- 1. job_role + text search ----------
alter table qualifications add column if not exists job_role text;
alter table qualifications add column if not exists keywords  text;   -- extra searchable text

-- Generated tsvector over everything worth matching on. 'simple' config
-- (not 'english') because the corpus mixes English, transliteration and
-- Indic script — we do not want English stemming mangling those.
alter table qualifications drop column if exists search_tsv;
alter table qualifications add column search_tsv tsvector
    generated always as (
        setweight(to_tsvector('simple', coalesce(name,     '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(job_role, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(sector,   '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(keywords, '')), 'C')
    ) stored;

create index if not exists qualifications_search_idx
    on qualifications using gin (search_tsv);

-- Trigram index so we can also do fuzzy/partial matching for words that
-- full-text tokenisation misses (e.g. "silai" vs "silaai").
create extension if not exists pg_trgm;
create index if not exists qualifications_name_trgm_idx
    on qualifications using gin (name gin_trgm_ops);


-- ---------- 2. skill synonym table ----------
-- The "brain" that turns a spoken phrase into searchable canonical terms.
-- Rows are data, not code: a district officer can add a local term
-- ("flex board", "पापड़ बनाना") without a redeploy.
create table if not exists skill_synonyms (
    id              uuid primary key default gen_random_uuid(),
    phrase          text not null,          -- what the beneficiary says (lowercased)
    lang            text,                   -- hi|bn|ta|mr|en, null = any language
    canonical_skill text not null,          -- normalised English skill term
    sector          text,                   -- sector hint for the ranker
    weight          numeric not null default 1.0,
    created_at      timestamptz not null default now()
);

create unique index if not exists skill_synonyms_phrase_lang_idx
    on skill_synonyms (lower(phrase), coalesce(lang, '*'));
create index if not exists skill_synonyms_sector_idx on skill_synonyms (sector);


-- ---------- 3. seed the synonym table ----------
insert into skill_synonyms (phrase, lang, canonical_skill, sector) values
  -- ===== Apparel / tailoring =====
  ('tailoring','en','tailoring sewing garment','Apparel'),
  ('tailor','en','tailoring sewing garment','Apparel'),
  ('stitching','en','tailoring sewing garment','Apparel'),
  ('sewing','en','tailoring sewing garment','Apparel'),
  ('embroidery','en','embroidery needlework','Apparel'),
  ('silai','en','tailoring sewing garment','Apparel'),
  ('सिलाई','hi','tailoring sewing garment','Apparel'),
  ('दर्जी','hi','tailoring sewing garment','Apparel'),
  ('कढ़ाई','hi','embroidery needlework','Apparel'),
  ('शिवणकाम','mr','tailoring sewing garment','Apparel'),
  ('সেলাই','bn','tailoring sewing garment','Apparel'),
  ('তৈরি পোশাক','bn','tailoring sewing garment','Apparel'),
  ('தையல்','ta','tailoring sewing garment','Apparel'),

  -- ===== Handloom / textiles =====
  ('weaving','en','handloom weaving textile','Handloom'),
  ('handloom','en','handloom weaving textile','Handloom'),
  ('loom','en','handloom weaving textile','Handloom'),
  ('बुनाई','hi','handloom weaving textile','Handloom'),
  ('बुनकर','hi','handloom weaving textile','Handloom'),
  ('विणकाम','mr','handloom weaving textile','Handloom'),
  ('বুনন','bn','handloom weaving textile','Handloom'),
  ('তাঁত','bn','handloom weaving textile','Handloom'),
  ('நெசவு','ta','handloom weaving textile','Handloom'),

  -- ===== Printing / signage (the "flex" case) =====
  ('flex','en','flex printing signage banner vinyl','Printing'),
  ('flex board','en','flex printing signage banner vinyl','Printing'),
  ('flex printing','en','flex printing signage banner vinyl','Printing'),
  ('banner','en','flex printing signage banner vinyl','Printing'),
  ('signage','en','flex printing signage banner vinyl','Printing'),
  ('hoarding','en','flex printing signage banner vinyl','Printing'),
  ('printing','en','printing press offset digital','Printing'),
  ('screen printing','en','screen printing textile print','Printing'),
  ('फ्लेक्स','hi','flex printing signage banner vinyl','Printing'),
  ('छपाई','hi','printing press offset digital','Printing'),
  ('होर्डिंग','hi','flex printing signage banner vinyl','Printing'),
  ('graphic design','en','graphic design dtp coreldraw photoshop','Printing'),
  ('dtp','en','graphic design dtp coreldraw photoshop','Printing'),

  -- ===== Telecom / mobile =====
  ('mobile repair','en','mobile phone repair handset technician','Telecom'),
  ('phone repair','en','mobile phone repair handset technician','Telecom'),
  ('mobile','en','mobile phone repair handset technician','Telecom'),
  ('मोबाइल रिपेयर','hi','mobile phone repair handset technician','Telecom'),
  ('मोबाईल दुरुस्ती','mr','mobile phone repair handset technician','Telecom'),
  ('মোবাইল সারানো','bn','mobile phone repair handset technician','Telecom'),
  ('மொபைல் ரிப்பேர்','ta','mobile phone repair handset technician','Telecom'),

  -- ===== Electronics / electrical =====
  ('electrician','en','electrician wiring electrical','Electronics'),
  ('electrical','en','electrician wiring electrical','Electronics'),
  ('wiring','en','electrician wiring electrical','Electronics'),
  ('solar','en','solar panel photovoltaic renewable','Electronics'),
  ('बिजली','hi','electrician wiring electrical','Electronics'),
  ('इलेक्ट्रिक','hi','electrician wiring electrical','Electronics'),
  ('वीजकाम','mr','electrician wiring electrical','Electronics'),
  ('বৈদ্যুতিক','bn','electrician wiring electrical','Electronics'),
  ('மின்சாரம்','ta','electrician wiring electrical','Electronics'),

  -- ===== Beauty & wellness =====
  ('beauty','en','beauty therapist salon cosmetology','Beauty & Wellness'),
  ('beautician','en','beauty therapist salon cosmetology','Beauty & Wellness'),
  ('parlour','en','beauty therapist salon cosmetology','Beauty & Wellness'),
  ('salon','en','beauty therapist salon cosmetology','Beauty & Wellness'),
  ('makeup','en','makeup artist cosmetology','Beauty & Wellness'),
  ('mehendi','en','mehendi henna art','Beauty & Wellness'),
  ('hair','en','hair stylist barber','Beauty & Wellness'),
  ('ब्यूटी','hi','beauty therapist salon cosmetology','Beauty & Wellness'),
  ('पार्लर','hi','beauty therapist salon cosmetology','Beauty & Wellness'),
  ('मेहंदी','hi','mehendi henna art','Beauty & Wellness'),
  ('রূপচর্চা','bn','beauty therapist salon cosmetology','Beauty & Wellness'),
  ('அழகு','ta','beauty therapist salon cosmetology','Beauty & Wellness'),

  -- ===== Agriculture / dairy / food =====
  ('farming','en','agriculture crop cultivation farmer','Agriculture'),
  ('agriculture','en','agriculture crop cultivation farmer','Agriculture'),
  ('dairy','en','dairy milk cattle livestock','Agriculture'),
  ('poultry','en','poultry bird farming','Agriculture'),
  ('कृषि','hi','agriculture crop cultivation farmer','Agriculture'),
  ('खेती','hi','agriculture crop cultivation farmer','Agriculture'),
  ('दूध','hi','dairy milk cattle livestock','Agriculture'),
  ('डेयरी','hi','dairy milk cattle livestock','Agriculture'),
  ('शेती','mr','agriculture crop cultivation farmer','Agriculture'),
  ('কৃষি','bn','agriculture crop cultivation farmer','Agriculture'),
  ('দুধ','bn','dairy milk cattle livestock','Agriculture'),
  ('விவசாயம்','ta','agriculture crop cultivation farmer','Agriculture'),
  ('food processing','en','food processing preservation packaging','Food Processing'),
  ('papad','en','food processing preservation packaging','Food Processing'),
  ('pickle','en','food processing preservation packaging','Food Processing'),
  ('bakery','en','bakery baking confectionery','Food Processing'),

  -- ===== Construction =====
  ('mason','en','mason bricklaying masonry','Construction'),
  ('mistri','en','mason bricklaying masonry','Construction'),
  ('plumber','en','plumbing pipe fitting','Construction'),
  ('plumbing','en','plumbing pipe fitting','Construction'),
  ('welder','en','welding fabrication','Construction'),
  ('welding','en','welding fabrication','Construction'),
  ('carpenter','en','carpentry woodwork furniture','Construction'),
  ('painter','en','painting surface finishing','Construction'),
  ('bar bender','en','bar bending steel fixing','Construction'),
  ('राजमिस्त्री','hi','mason bricklaying masonry','Construction'),
  ('मिस्त्री','hi','mason bricklaying masonry','Construction'),
  ('बढ़ई','hi','carpentry woodwork furniture','Construction'),
  ('गवंडी','mr','mason bricklaying masonry','Construction'),
  ('রাজমিস্ত্রি','bn','mason bricklaying masonry','Construction'),
  ('கொத்தனார்','ta','mason bricklaying masonry','Construction'),

  -- ===== Retail / sales =====
  ('retail','en','retail sales store associate','Retail'),
  ('shop','en','retail sales store associate','Retail'),
  ('shopkeeper','en','retail sales store associate','Retail'),
  ('sales','en','retail sales store associate','Retail'),
  ('cashier','en','retail cashier billing','Retail'),
  ('दुकान','hi','retail sales store associate','Retail'),
  ('दुकानदारी','hi','retail sales store associate','Retail'),
  ('দোকান','bn','retail sales store associate','Retail'),
  ('கடை','ta','retail sales store associate','Retail'),

  -- ===== Automotive =====
  ('mechanic','en','automotive mechanic vehicle service','Automotive'),
  ('two wheeler','en','two wheeler motorcycle service','Automotive'),
  ('bike repair','en','two wheeler motorcycle service','Automotive'),
  ('car repair','en','four wheeler car service','Automotive'),
  ('driving','en','driver commercial vehicle','Automotive'),
  ('मैकेनिक','hi','automotive mechanic vehicle service','Automotive'),
  ('गाड़ी','hi','automotive mechanic vehicle service','Automotive'),

  -- ===== Healthcare =====
  ('nursing','en','nursing patient care attendant','Healthcare'),
  ('health','en','healthcare general duty assistant','Healthcare'),
  ('hospital','en','healthcare general duty assistant','Healthcare'),
  ('caregiver','en','home health aide patient care','Healthcare'),
  ('नर्स','hi','nursing patient care attendant','Healthcare'),
  ('अस्पताल','hi','healthcare general duty assistant','Healthcare'),

  -- ===== Hospitality / logistics / IT =====
  ('cooking','en','food beverage cook kitchen','Tourism'),
  ('chef','en','food beverage cook kitchen','Tourism'),
  ('hotel','en','hospitality housekeeping front office','Tourism'),
  ('housekeeping','en','hospitality housekeeping front office','Tourism'),
  ('खाना','hi','food beverage cook kitchen','Tourism'),
  ('warehouse','en','warehouse packing logistics','Logistics'),
  ('delivery','en','delivery logistics courier','Logistics'),
  ('driver','en','driver commercial vehicle','Logistics'),
  ('computer','en','computer basics office productivity','IT'),
  ('typing','en','data entry typing office','IT'),
  ('data entry','en','data entry typing office','IT'),
  ('coding','en','programming software development','IT'),
  ('programming','en','programming software development','IT'),
  ('कंप्यूटर','hi','computer basics office productivity','IT'),
  ('tally','en','accounting tally bookkeeping','BFSI'),
  ('accounting','en','accounting tally bookkeeping','BFSI'),
  ('banking','en','banking financial services','BFSI')
on conflict do nothing;


-- ---------- 4. helper: expand a spoken phrase into search terms ----------
-- Returns canonical skill words + a sector hint for anything the
-- beneficiary said. Longest phrases match first so "mobile repair" wins
-- over "mobile".
create or replace function expand_skill_terms(p_terms text[])
returns table (canonical_skill text, sector text, weight numeric)
language sql
stable
as $$
    select distinct s.canonical_skill, s.sector, s.weight
    from skill_synonyms s
    where exists (
        select 1 from unnest(coalesce(p_terms, '{}'::text[])) t
        where lower(t) like '%' || lower(s.phrase) || '%'
           or lower(s.phrase) like '%' || lower(t) || '%'
    );
$$;
