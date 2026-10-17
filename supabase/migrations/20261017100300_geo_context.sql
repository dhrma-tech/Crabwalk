-- Travel matrix, correction factors, context caches, alerts, utilities, trails, config

-- ---------------------------------------------------------------- matrix
create table public.matrix_points (
  id uuid primary key default gen_random_uuid(),
  entity_type public.entity_type not null,
  entity_id uuid not null,
  location extensions.geography(Point, 4326) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (entity_type, entity_id)
);

create table public.travel_matrix (
  from_point_id uuid not null references public.matrix_points (id) on delete cascade,
  to_point_id uuid not null references public.matrix_points (id) on delete cascade,
  duration_s integer not null,
  distance_m integer not null,
  duration_corrected_s integer not null,
  route_shape text, -- encoded polyline; only for pairs <= 60 km (A4)
  computed_at timestamptz not null default now(),
  primary key (from_point_id, to_point_id),
  check (from_point_id <> to_point_id)
);

create type public.correction_type as enum ('ghat', 'coastal', 'monsoon');
create table public.correction_factors (
  id uuid primary key default gen_random_uuid(),
  type public.correction_type not null unique,
  multiplier numeric(4, 2) not null check (multiplier >= 1),
  active_months smallint[] check (active_months <@ array[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.road_segments_flags (
  id uuid primary key default gen_random_uuid(),
  osm_way_id bigint not null,
  flag public.correction_type not null check (flag in ('ghat', 'coastal')),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (osm_way_id, flag)
);

-- ---------------------------------------------------------------- weather + tides
create table public.weather_points (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location extensions.geography(Point, 4326) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.weather_cache (
  id uuid primary key default gen_random_uuid(),
  point_id uuid not null references public.weather_points (id) on delete cascade,
  fetched_at timestamptz not null default now(),
  payload jsonb not null,
  summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index on public.weather_cache (point_id, fetched_at desc);

create table public.tide_stations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location extensions.geography(Point, 4326) not null,
  provider_station_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.places
  add constraint places_tide_station_fk foreign key (tide_station_id) references public.tide_stations (id);

create type public.tide_provider as enum ('tidesatlas', 'tidecheck');
create table public.tide_cache (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.tide_stations (id) on delete cascade,
  date date not null,
  extremes jsonb not null,
  curve jsonb,
  provider public.tide_provider not null,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (station_id, date)
);

create table public.place_tide_rules (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null unique references public.places (id) on delete cascade,
  max_safe_height_m numeric(4, 2),
  rule_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ---------------------------------------------------------------- events + alerts
create table public.events_calendar (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_hi text,
  name_mr text,
  type text not null check (type in ('festival', 'jatra', 'season')),
  from_date date not null,
  to_date date not null check (to_date >= from_date),
  taluka_id uuid references public.talukas (id),
  impact jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create type public.alert_type as enum ('road_condition', 'ghat', 'landslide', 'closure');
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  type public.alert_type not null,
  geometry extensions.geography(Geometry, 4326) not null,
  severity text not null check (severity in ('caution', 'danger')),
  reason_en text,
  reason_hi text,
  reason_mr text,
  source text not null check (source in ('verifier', 'user_report', 'team_news')),
  reported_at timestamptz not null default now(),
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index on public.alerts (expires_at);

-- Per-type alert TTL (G9)
create table public.alert_type_ttl (
  type public.alert_type primary key,
  ttl_hours integer not null check (ttl_hours > 0),
  updated_at timestamptz
);

-- Tunable key/value config (G10 etc.)
create table public.app_config (
  key text primary key,
  value jsonb not null,
  notes text,
  updated_at timestamptz
);

-- ---------------------------------------------------------------- utility POIs + trails
create type public.utility_type as enum (
  'fuel', 'atm', 'hospital', 'pharmacy', 'police', 'toilet', 'ev_charger',
  'mechanic', 'bus_stand', 'railway_station', 'ferry_jetty'
);
create table public.utility_pois (
  id uuid primary key default gen_random_uuid(),
  type public.utility_type not null,
  location extensions.geography(Point, 4326) not null,
  name text,
  osm_id bigint,
  source text not null check (source in ('osm', 'verifier')),
  phone text,
  taluka_id uuid references public.talukas (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index on public.utility_pois using gist (location);
create index on public.utility_pois (type);

create table public.trails (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_hi text,
  name_mr text,
  gpx_storage_path text,
  geometry extensions.geography(LineString, 4326),
  source text not null check (source in ('osm_verified', 'team_recorded')),
  difficulty text, -- scale [OPEN]
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ---------------------------------------------------------------- RLS
alter table public.matrix_points enable row level security;
alter table public.travel_matrix enable row level security;
alter table public.correction_factors enable row level security;
alter table public.road_segments_flags enable row level security;
alter table public.weather_points enable row level security;
alter table public.weather_cache enable row level security;
alter table public.tide_stations enable row level security;
alter table public.tide_cache enable row level security;
alter table public.place_tide_rules enable row level security;
alter table public.events_calendar enable row level security;
alter table public.alerts enable row level security;
alter table public.alert_type_ttl enable row level security;
alter table public.app_config enable row level security;
alter table public.utility_pois enable row level security;
alter table public.trails enable row level security;

-- Public reference/context data: read by all, written by admin (pipelines/crons use service role).
create policy "public read" on public.matrix_points for select using (true);
create policy "admin write" on public.matrix_points for all using (app.is_admin()) with check (app.is_admin());
create policy "public read" on public.travel_matrix for select using (true);
create policy "admin write" on public.travel_matrix for all using (app.is_admin()) with check (app.is_admin());
create policy "public read" on public.correction_factors for select using (true);
create policy "admin write" on public.correction_factors for all using (app.is_admin()) with check (app.is_admin());
create policy "public read" on public.weather_points for select using (true);
create policy "admin write" on public.weather_points for all using (app.is_admin()) with check (app.is_admin());
create policy "public read" on public.weather_cache for select using (true);
create policy "admin write" on public.weather_cache for all using (app.is_admin()) with check (app.is_admin());
create policy "public read" on public.tide_stations for select using (true);
create policy "admin write" on public.tide_stations for all using (app.is_admin()) with check (app.is_admin());
create policy "public read" on public.tide_cache for select using (true);
create policy "admin write" on public.tide_cache for all using (app.is_admin()) with check (app.is_admin());
create policy "public read" on public.alert_type_ttl for select using (true);
create policy "admin write" on public.alert_type_ttl for all using (app.is_admin()) with check (app.is_admin());
create policy "public read" on public.app_config for select using (true);
create policy "admin write" on public.app_config for all using (app.is_admin()) with check (app.is_admin());
create policy "public read" on public.trails for select using (true);
create policy "admin write" on public.trails for all using (app.is_admin()) with check (app.is_admin());

create policy "public read" on public.events_calendar for select using (true);
create policy "reviewer write" on public.events_calendar for all
  using (app.is_admin() or app.has_role('reviewer')) with check (app.is_admin() or app.has_role('reviewer'));

create policy "public read" on public.alerts for select using (true);
create policy "staff write" on public.alerts for all
  using (app.is_admin() or app.has_role('reviewer') or app.has_role('verifier'))
  with check (app.is_admin() or app.has_role('reviewer') or app.has_role('verifier'));

create policy "public read" on public.utility_pois for select using (true);
create policy "staff write" on public.utility_pois for all
  using (app.is_admin() or app.has_role('reviewer') or app.has_role('verifier', taluka_id))
  with check (app.is_admin() or app.has_role('reviewer') or app.has_role('verifier', taluka_id));

-- Internal tables
create policy "staff read" on public.road_segments_flags for select
  using (app.is_admin() or app.has_role('reviewer') or app.has_role('verifier'));
create policy "admin write" on public.road_segments_flags for all using (app.is_admin()) with check (app.is_admin());
create policy "staff all" on public.place_tide_rules for all
  using (app.is_staff_for('place', place_id)) with check (app.is_staff_for('place', place_id));
