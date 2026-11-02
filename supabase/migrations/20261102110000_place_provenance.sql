-- Place provenance (phase-10b, DECISIONS T-6 / T-48; Report 1 §1.4–1.5): how a place was checked, and where from.
-- 'field' = a verifier stood there; 'desk' = researched online. The UI says "Visited" only for field rows.
-- Existing rows came from the field form (or seed data), so they default to 'field'.
create type public.verification_method as enum ('desk', 'field');

alter table public.places
  add column verification_method public.verification_method not null default 'field',
  add column source_urls text[] not null default '{}',
  -- A desk row must say where it was checked; at most 10 sources.
  add constraint places_desk_sources_check
    check (verification_method = 'field' or cardinality(source_urls) between 1 and 10),
  add constraint places_source_urls_max check (cardinality(source_urls) <= 10);
