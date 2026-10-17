-- Ratings, reviews, verified visits, booking proofs, QR, sponsors, reports

-- ---------------------------------------------------------------- ratings
create table public.verdicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_type public.entity_type not null,
  entity_id uuid not null,
  group_type public.group_type not null,
  level smallint not null check (level between 1 and 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (user_id, entity_type, entity_id, group_type)
);
create index on public.verdicts (entity_type, entity_id);

create type public.sub_score_dimension as enum (
  'taste', 'authenticity', 'hygiene', 'value', 'cleanliness', 'host', 'location'
);
create table public.sub_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_type public.entity_type not null,
  entity_id uuid not null,
  dimension public.sub_score_dimension not null,
  score smallint not null check (score between 0 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (user_id, entity_type, entity_id, dimension)
);
create index on public.sub_scores (entity_type, entity_id);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_type public.entity_type not null,
  entity_id uuid not null,
  group_type public.group_type not null,
  text text,
  photo_ids uuid[] not null default '{}',
  moderation_status public.review_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index on public.reviews (entity_type, entity_id);

create table public.review_summaries (
  id uuid primary key default gen_random_uuid(),
  entity_type public.entity_type not null,
  entity_id uuid not null,
  lang public.lang not null,
  summary text not null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (entity_type, entity_id, lang)
);

create type public.visit_method as enum ('qr_gps', 'booking_proof');
create table public.verified_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_type public.entity_type not null,
  entity_id uuid not null,
  method public.visit_method not null,
  distance_m integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index on public.verified_visits (user_id, entity_type, entity_id);

-- Booking-proof screenshots (G6). File lives in a private bucket; deleted after delete_after.
create table public.booking_proofs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_type public.entity_type not null,
  entity_id uuid not null,
  storage_path text,
  status public.review_status not null default 'pending',
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  delete_after timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  check (delete_after <= created_at + interval '30 days')
);

-- Aggregate per group type (maintained in P5). "All" = query across groups (B13).
create table public.verdict_agg (
  entity_type public.entity_type not null,
  entity_id uuid not null,
  group_type public.group_type not null,
  counts integer[] not null default '{0,0,0,0}' check (array_length(counts, 1) = 4),
  total integer not null default 0,
  winner_level smallint check (winner_level between 1 and 4),
  winner_pct numeric(5, 4),
  is_new boolean not null default true,
  updated_at timestamptz,
  primary key (entity_type, entity_id, group_type)
);

create function app.has_verified_visit(_type public.entity_type, _id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.verified_visits
    where user_id = auth.uid() and entity_type = _type and entity_id = _id
  );
$$;

-- ---------------------------------------------------------------- QR
create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  entity_type public.entity_type,
  entity_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z]{2,5}-[0-9]{3,}$'),
  entity_type public.qr_entity_type not null,
  entity_id uuid not null,
  sponsor_id uuid references public.sponsors (id),
  installed_at timestamptz,
  permission_status text not null default 'pending' check (permission_status in ('pending', 'granted')),
  permission_body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.qr_scans (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.qr_codes (code),
  scanned_at timestamptz not null default now(),
  lang public.lang,
  session_hash text not null,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);
create index on public.qr_scans (code, scanned_at desc);

create type public.report_type as enum ('broken_qr', 'garbage', 'unsafe_spot', 'wrong_info');
create type public.report_status as enum ('new', 'triaged', 'fixed', 'rejected');
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  entity_type public.qr_entity_type not null,
  entity_id uuid not null,
  qr_code text references public.qr_codes (code),
  type public.report_type not null,
  text text,
  photo_id uuid references public.photos (id),
  status public.report_status not null default 'new',
  assigned_to uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create function app.report_taluka(_type public.qr_entity_type, _id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select case
    when _type in ('station', 'bus_stand') then (select taluka_id from public.utility_pois where id = _id)
    else app.listing_taluka(_type::text::public.listing_type, _id)
  end;
$$;

-- ---------------------------------------------------------------- RLS
alter table public.verdicts enable row level security;
alter table public.sub_scores enable row level security;
alter table public.reviews enable row level security;
alter table public.review_summaries enable row level security;
alter table public.verified_visits enable row level security;
alter table public.booking_proofs enable row level security;
alter table public.verdict_agg enable row level security;
alter table public.sponsors enable row level security;
alter table public.qr_codes enable row level security;
alter table public.qr_scans enable row level security;
alter table public.reports enable row level security;

-- Verdicts: individual rows private; aggregates public. Owners never rate their own listing.
create policy "own read" on public.verdicts for select using (user_id = auth.uid() or app.is_admin());
create policy "own insert" on public.verdicts for insert
  with check (user_id = auth.uid() and not app.has_role('owner', entity_type::text::public.listing_type, entity_id));
create policy "own update" on public.verdicts for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and not app.has_role('owner', entity_type::text::public.listing_type, entity_id));
create policy "own delete" on public.verdicts for delete using (user_id = auth.uid() or app.is_admin());

-- Sub-scores: hygiene/cleanliness only with a verified visit (server-enforced here).
create policy "own read" on public.sub_scores for select using (user_id = auth.uid() or app.is_admin());
create policy "own insert" on public.sub_scores for insert
  with check (user_id = auth.uid()
              and not app.has_role('owner', entity_type::text::public.listing_type, entity_id)
              and (dimension not in ('hygiene', 'cleanliness') or app.has_verified_visit(entity_type, entity_id)));
create policy "own update" on public.sub_scores for update using (user_id = auth.uid())
  with check (user_id = auth.uid()
              and not app.has_role('owner', entity_type::text::public.listing_type, entity_id)
              and (dimension not in ('hygiene', 'cleanliness') or app.has_verified_visit(entity_type, entity_id)));
create policy "own delete" on public.sub_scores for delete using (user_id = auth.uid() or app.is_admin());

create policy "public read agg" on public.verdict_agg for select using (true);
create policy "public read" on public.review_summaries for select using (true);

-- Reviews: approved are public; author sees own; reviewers moderate.
create policy "read" on public.reviews for select
  using (moderation_status = 'approved' or user_id = auth.uid() or app.has_role('reviewer') or app.is_admin());
create policy "own insert" on public.reviews for insert
  with check (user_id = auth.uid() and moderation_status = 'pending'
              and not app.has_role('owner', entity_type::text::public.listing_type, entity_id));
create policy "moderate" on public.reviews for update
  using (app.has_role('reviewer') or app.is_admin()) with check (app.has_role('reviewer') or app.is_admin());
create policy "own delete" on public.reviews for delete using (user_id = auth.uid() or app.is_admin());

-- Verified visits: inserted by the server only (distance computed server-side).
create policy "own read" on public.verified_visits for select using (user_id = auth.uid() or app.is_admin());

-- Booking proofs: user submits; verifier of the listing's taluka reviews.
create policy "read" on public.booking_proofs for select
  using (user_id = auth.uid() or app.is_staff_for(entity_type::text::public.listing_type, entity_id));
create policy "own insert" on public.booking_proofs for insert
  with check (user_id = auth.uid() and status = 'pending' and reviewed_by is null);
create policy "staff review" on public.booking_proofs for update
  using (app.is_staff_for(entity_type::text::public.listing_type, entity_id))
  with check (app.is_staff_for(entity_type::text::public.listing_type, entity_id));

-- Sponsors: anon sees name only (column grant below); display only.
create policy "read" on public.sponsors for select using (true);
create policy "admin write" on public.sponsors for all using (app.is_admin()) with check (app.is_admin());
revoke select on public.sponsors from anon;
grant select (id, name) on public.sponsors to anon;

create policy "public read" on public.qr_codes for select using (true);
create policy "admin write" on public.qr_codes for all using (app.is_admin()) with check (app.is_admin());

-- qr_scans: server insert only, no client access (RLS on, no policies).

-- Reports: anyone may file; verifiers of the taluka triage; reviewers read.
create policy "anyone insert" on public.reports for insert
  with check (status = 'new' and assigned_to is null);
create policy "staff read" on public.reports for select
  using (app.is_admin() or app.has_role('reviewer') or app.has_role('verifier', app.report_taluka(entity_type, entity_id)));
create policy "verifier update" on public.reports for update
  using (app.is_admin() or app.has_role('verifier', app.report_taluka(entity_type, entity_id)))
  with check (app.is_admin() or app.has_role('verifier', app.report_taluka(entity_type, entity_id)));
