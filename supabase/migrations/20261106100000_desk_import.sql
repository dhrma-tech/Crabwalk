-- Desk data import (data/, DATA_REQUIREMENTS §4, user 2026-11-05).
-- S1: desk rows arrive without a pin (stays and eateries have none, 75 places have none). A listing may be saved
-- without a location but can't go live without one. Every public reader already filters on `published`.
alter table public.places alter column location drop not null;
alter table public.stays alter column location drop not null;
alter table public.eateries alter column location drop not null;
alter table public.places add constraint places_pin_to_publish check (status <> 'published' or location is not null);
alter table public.stays add constraint stays_pin_to_publish check (status <> 'published' or location is not null);
alter table public.eateries add constraint eateries_pin_to_publish check (status <> 'published' or location is not null);

-- S2: events get a status so imported drafts don't reach the Today strip or the planner. Existing and
-- admin-entered rows stay published (the default); the importer writes 'draft'.
alter table public.events_calendar add column status public.content_status not null default 'published';

-- S3: what the desk import keeps about each row — `_sources`, `_review`, `_collected_by` and source keys with no
-- column (google_place_id, official_url, OSM ids, …). `needs_review` puts a row first in the review queue
-- ("Check first"). Staff read only; the importer writes as the database owner.
create table public.import_audit (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('place', 'eatery', 'stay', 'dish', 'event', 'seasonal', 'utility')),
  entity_key text not null,
  source_file text not null,
  meta jsonb not null default '{}',
  needs_review boolean not null default false,
  review_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (entity_type, entity_key)
);
create trigger set_updated_at before update on public.import_audit
  for each row execute function app.set_updated_at();
alter table public.import_audit enable row level security;
create policy "staff read" on public.import_audit for select to authenticated
  using (app.is_admin() or app.has_role('reviewer') or app.has_role('verifier'));
