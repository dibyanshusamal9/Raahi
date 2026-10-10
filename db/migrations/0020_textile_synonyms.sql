-- Textiles. Callers ask for "textile(s)", often as the English word written
-- in their own script ("टेक्सटाइल्स"), and no synonym covered it: the ranker
-- found no skill and recommended unrelated courses (Yoga Therapy, Telecom).
-- These map the word, and the mill trades it stands for, to the Textile &
-- Handloom courses (spinning, weaving, knitting, dyeing, finishing).

set client_encoding = 'UTF8';   -- the synonyms below are in Indian scripts

insert into skill_labels (canonical_skill, label, sector) values
    ('textile spinning weaving knitting dyeing', 'Textiles', 'Textile & Handloom')
on conflict (canonical_skill) do update
    set label = excluded.label, sector = excluded.sector;

insert into skill_synonyms (phrase, lang, canonical_skill, sector)
select v.phrase, v.lang, 'textile spinning weaving knitting dyeing', 'Textile & Handloom'
  from (values
    ('textile',          'en'),
    ('spinning',         'en'),
    ('knitting',         'en'),
    ('dyeing',           'en'),
    ('टेक्सटाइल',          'hi'),
    ('टेक्स्टाइल',          'hi'),
    ('टैक्सटाइल',          'hi'),
    ('कताई',             'hi'),
    ('कपड़ा मिल',          'hi'),
    ('वस्त्र उद्योग',        'hi'),
    ('टेक्सटाईल',          'mr'),
    ('कापड गिरणी',         'mr'),
    ('वस्त्रोद्योग',         'mr'),
    ('টেক্সটাইল',          'bn'),
    ('বস্ত্র শিল্প',         'bn'),
    ('டெக்ஸ்டைல்',          'ta'),
    ('ஜவுளி',             'ta'),
    ('టెక్స్టైల్',          'te'),
    ('టెక్స్‌టైల్',          'te'),
    ('వస్త్ర పరిశ్రమ',       'te'),
    ('ટેક્સટાઇલ',          'gu'),
    ('કાપડ ઉદ્યોગ',         'gu'),
    ('ಜವಳಿ',             'kn'),
    ('ടെക്സ്റ്റൈൽ',         'ml'),
    ('ਟੈਕਸਟਾਈਲ',          'pa'),
    ('ବସ୍ତ୍ର ଶିଳ୍ପ',         'or')
  ) as v(phrase, lang)
on conflict do nothing;
