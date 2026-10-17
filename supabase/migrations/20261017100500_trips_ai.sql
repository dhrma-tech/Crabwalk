-- Trips, group votes, pattern analysis, AI tables

create type public.trip_pace as enum ('relaxed', 'balanced', 'packed');
create type public.trip_status as enum ('draft', 'saved', 'completed');

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  days smallint not null check (days between 1 and 30),
  start_point jsonb,
  budget integer check (budget >= 0),
  group_type public.group_type,
  interests text[] not null default '{}',
  pace public.trip_pace not null default 'balanced',
  standout boolean not null default false,
  share_token text unique default encode(extensions.gen_random_bytes(16), 'hex'),
  status public.trip_status not null default 'draft',
  is_ready_made boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create type public.stop_kind as enum ('place', 'stay', 'meal');
create table public.trip_stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  day smallint not null check (day >= 1),
  "order" smallint not null,
  entity_type public.entity_type not null,
  entity_id uuid not null,
  arrive_at timestamptz,
  depart_at timestamptz,
  travel_from_prev_s integer,
  reason_en text,
  reason_hi text,
  reason_mr text,
  kind public.stop_kind not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (trip_id, day, "order")
);

create table public.trip_budget (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null unique references public.trips (id) on delete cascade,
  stay integer not null default 0,
  food integer not null default 0,
  fuel integer not null default 0,
  entry integer not null default 0,
  activities integer not null default 0,
  vehicle_mileage_kmpl numeric(5, 2),
  fuel_price numeric(6, 2),
  people smallint not null default 1 check (people >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.group_votes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  voter_token text not null,
  voter_name text,
  entity_id uuid not null,
  vote text not null check (vote in ('up', 'down')),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (trip_id, voter_token, entity_id)
);

create table public.published_routes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null unique references public.trips (id) on delete cascade,
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected')),
  reviewed_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- Opt-in only; no user id stored
create table public.dwell_events (
  id uuid primary key default gen_random_uuid(),
  anon_id text not null,
  place_id uuid not null references public.places (id) on delete cascade,
  arrived_at timestamptz not null,
  left_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.route_stats (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('trending', 'underrated')),
  stops uuid[] not null,
  score numeric not null,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ---------------------------------------------------------------- AI
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  message_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (user_id, date)
);

create type public.ai_action_status as enum ('proposed', 'applied', 'discarded');
create table public.ai_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('create_plan', 'edit_plan', 'open_map', 'start_nav', 'shortlist_stays', 'save_share')),
  preview jsonb not null,
  status public.ai_action_status not null default 'proposed',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create type public.draft_status as enum ('draft', 'approved', 'rejected');
create table public.content_drafts (
  id uuid primary key default gen_random_uuid(),
  entity_type public.listing_type not null,
  entity_id uuid not null,
  lang public.lang not null,
  field text not null,
  draft_text text not null,
  status public.draft_status not null default 'draft',
  reviewer_id uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ---------------------------------------------------------------- trip helpers
create function app.owns_trip(_trip uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.trips where id = _trip and owner_id = auth.uid());
$$;

-- Read-only shared trip by token (anon). Exposed as RPC.
create function public.get_shared_trip(_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'trip', to_jsonb(t) - 'owner_id' - 'share_token',
    'stops', coalesce((select jsonb_agg(to_jsonb(s) order by s.day, s."order")
                       from public.trip_stops s where s.trip_id = t.id), '[]'::jsonb)
  )
  from public.trips t
  where t.share_token = _token;
$$;
grant execute on function public.get_shared_trip(text) to anon, authenticated;

-- Guest group vote with a valid share token (no login).
create function public.cast_group_vote(_token text, _voter_token text, _voter_name text, _entity_id uuid, _vote text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  _trip uuid;
begin
  select id into _trip from public.trips where share_token = _token;
  if _trip is null then
    raise exception 'invalid share token' using errcode = '42501';
  end if;
  insert into public.group_votes (trip_id, voter_token, voter_name, entity_id, vote)
  values (_trip, _voter_token, _voter_name, _entity_id, _vote)
  on conflict (trip_id, voter_token, entity_id)
  do update set vote = excluded.vote, voter_name = excluded.voter_name;
end;
$$;
grant execute on function public.cast_group_vote(text, text, text, uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------- RLS
alter table public.trips enable row level security;
alter table public.trip_stops enable row level security;
alter table public.trip_budget enable row level security;
alter table public.group_votes enable row level security;
alter table public.published_routes enable row level security;
alter table public.dwell_events enable row level security;
alter table public.route_stats enable row level security;
alter table public.ai_usage enable row level security;
alter table public.ai_actions enable row level security;
alter table public.content_drafts enable row level security;

create policy "own all" on public.trips for all
  using (owner_id = auth.uid() or app.is_admin()) with check (owner_id = auth.uid() or app.is_admin());
create policy "public ready-made" on public.trips for select using (is_ready_made);
create policy "public ready-made" on public.trip_stops for select
  using (exists (select 1 from public.trips t where t.id = trip_id and t.is_ready_made));
create policy "own all" on public.trip_stops for all
  using (app.owns_trip(trip_id) or app.is_admin()) with check (app.owns_trip(trip_id) or app.is_admin());
create policy "own all" on public.trip_budget for all
  using (app.owns_trip(trip_id) or app.is_admin()) with check (app.owns_trip(trip_id) or app.is_admin());

-- Votes written via cast_group_vote(); trip owner reads them.
create policy "owner read" on public.group_votes for select using (app.owns_trip(trip_id) or app.is_admin());

create policy "read" on public.published_routes for select
  using (status = 'approved' or app.owns_trip(trip_id) or app.has_role('reviewer') or app.is_admin());
create policy "own submit" on public.published_routes for insert
  with check (app.owns_trip(trip_id) and status = 'pending_review' and reviewed_by is null);
create policy "review" on public.published_routes for update
  using (app.has_role('reviewer') or app.is_admin()) with check (app.has_role('reviewer') or app.is_admin());

create policy "insert with consent" on public.dwell_events for insert
  with check (exists (
    select 1 from public.consents c
    where c.user_id = auth.uid() and c.type = 'dwell_time' and c.granted and c.revoked_at is null
  ));
create policy "admin read" on public.dwell_events for select using (app.is_admin());

create policy "public read" on public.route_stats for select using (true);

create policy "own read" on public.ai_usage for select using (user_id = auth.uid() or app.is_admin());
create policy "own read" on public.ai_actions for select using (user_id = auth.uid() or app.is_admin());

create policy "staff all" on public.content_drafts for all
  using (app.is_staff_for(entity_type, entity_id)) with check (app.is_staff_for(entity_type, entity_id));
