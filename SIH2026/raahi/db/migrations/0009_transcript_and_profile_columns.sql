-- Columns added during development via ad-hoc ALTERs; captured here so a fresh
-- database (local Docker or Supabase) has them without manual steps.
-- All idempotent.

-- Beneficiary profile: free-text education label ("Third Year college",
-- "Diploma / ITI") shown to the officer alongside the numeric NSQF level.
alter table beneficiaries add column if not exists name           text;
alter table beneficiaries add column if not exists education_note text;

-- Full saved conversation. `asked` / `heard_text` already existed; these add
-- the localized question actually spoken to the caller, and an English gloss of
-- native-script answers so an officer who doesn't read the script can follow.
alter table voice_turns add column if not exists asked_local text;
alter table voice_turns add column if not exists heard_en    text;
