-- The Python extractor normalises a spoken phrase to a SECTOR name before
-- writing beneficiaries.interests (e.g. "सिलाई" -> "apparel"), but
-- skill_synonyms only knew SPOKEN phrases ("सिलाई", "tailoring"). So
-- expand_skill_terms(ARRAY['apparel']) matched nothing and the ranker fell
-- back to generic scoring — a caller who said "tailoring" was being shown
-- "Dairy Farmer".
--
-- Teaching the table the canonical sector names closes the gap, so both
-- layers agree no matter which form reaches the ranker.

insert into skill_synonyms (phrase, lang, canonical_skill, sector) values
  ('apparel',            null, 'tailoring sewing garment apparel',            'Apparel'),
  ('handloom',           null, 'handloom weaving textile',                    'Handloom'),
  ('telecom',            null, 'mobile phone repair handset technician telecom','Telecom'),
  ('electronics',        null, 'electronics electrician wiring electrical',   'Electronics'),
  ('beauty & wellness',  null, 'beauty therapist salon cosmetology wellness', 'Beauty & Wellness'),
  ('agriculture',        null, 'agriculture crop cultivation farmer dairy',   'Agriculture'),
  ('construction',       null, 'construction mason bricklaying masonry',      'Construction'),
  ('retail',             null, 'retail sales store associate',                'Retail'),
  ('automotive',         null, 'automotive mechanic vehicle service',         'Automotive'),
  ('healthcare',         null, 'healthcare nursing patient care attendant',   'Healthcare'),
  ('food processing',    null, 'food processing preservation packaging',      'Food Processing'),
  ('logistics',          null, 'warehouse packing logistics delivery',        'Logistics'),
  ('tourism',            null, 'hospitality housekeeping food beverage',      'Tourism'),
  ('printing',           null, 'flex printing signage banner vinyl',          'Printing'),
  ('it',                 null, 'computer basics office productivity software','IT'),
  ('bfsi',               null, 'banking financial services accounting tally', 'BFSI')
on conflict do nothing;

-- expand_skill_terms matched on substrings in BOTH directions, which made
-- very short phrases dangerous: phrase 'it' is a substring of almost every
-- word, so ARRAY['tailoring'] was expanding into the IT sector. Require an
-- exact match for phrases shorter than 4 characters.
create or replace function expand_skill_terms(p_terms text[])
returns table (canonical_skill text, sector text, weight numeric)
language sql
stable
as $$
    select distinct s.canonical_skill, s.sector, s.weight
    from skill_synonyms s
    where exists (
        select 1 from unnest(coalesce(p_terms, '{}'::text[])) t
        where
            case
              -- short phrases ('it', 'ba') must match the spoken term exactly,
              -- otherwise they match as a substring of unrelated words
              when length(s.phrase) < 4 then lower(t) = lower(s.phrase)
              else lower(t) like '%' || lower(s.phrase) || '%'
                or lower(s.phrase) like '%' || lower(t) || '%'
            end
    );
$$;
