-- One training centre per (name, district). Lets the seed files update their
-- centres in place on a re-run instead of inserting duplicate centres.
create unique index if not exists training_centres_name_district_idx
    on training_centres (name, district);
