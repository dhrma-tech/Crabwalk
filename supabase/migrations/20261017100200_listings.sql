-- Places, stays, eateries, dishes and their child tables

create type public.place_category as enum (
  'beach', 'fort', 'temple', 'waterfall', 'viewpoint', 'backwater',
  'cave', 'museum', 'village', 'market', 'orchard'
);
create type public.monsoon_status as enum ('open', 'risky', 'closed');
create type public.season as enum ('turtle_nesting', 'mango', 'firefly', 'waterfall');
create type public.crowd_level as enum ('empty', 'calm', 'busy');
create type public.eatery_authenticity as enum ('home_style', 'local_legend', 'tourist_oriented');
create type public.price_source as enum ('owner', 'agoda', 'affiliate');

-- ---------------------------------------------------------------- places
create table public.places (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  category public.place_category not null,
  taluka_id uuid not null references public.talukas (id),
  location extensions.geography(Point, 4326) not null,
  entry_fee_text text,
  best_time_text text,
  how_to_reach_text text,
  nearest_station_text text,
  nearest_bus_stop_text text,
  is_hidden_gem boolean not null default false,
  is_tide_dependent boolean not null default false,
  tide_station_id uuid,
  monsoon_status public.monsoon_status not null default 'open',
  monsoon_reason text,
  food_delivery jsonb not null default '{}',
  status public.content_status not null default 'draft',
  last_verified_at timestamptz,
  next_recheck_at timestamptz,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index on public.places (taluka_id);
create index on public.places using gist (location);

create table public.place_translations (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  lang public.lang not null,
  name text not null,
  short_story text,
  history text,
  significance text,
  dos text,
  donts text,
  safety_text text,
  approved_by uuid references auth.users (id),
  approved_at timestamptz,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (place_id, lang)
);

create table public.place_hours (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens time,
  closes time,
  hours_unknown boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index on public.place_hours (place_id);

create table public.place_seasonal (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  season public.season not null,
  from_month smallint not null check (from_month between 1 and 12),
  to_month smallint not null check (to_month between 1 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.crowd_typical (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  season text,
  level public.crowd_level not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create type public.audio_source as enum ('tts', 'recorded');
create table public.audio_guides (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  lang public.lang not null,
  storage_path text not null,
  duration_s integer check (duration_s between 60 and 300),
  transcript text,
  source public.audio_source not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (place_id, lang)
);

create table public.place_embeddings (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null unique references public.places (id) on delete cascade,
  embedding extensions.vector(384) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.verifier_notes (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  author_id uuid references auth.users (id),
  notes text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ---------------------------------------------------------------- stays
create table public.stays (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  taluka_id uuid not null references public.talukas (id),
  location extensions.geography(Point, 4326) not null,
  vibe_tags text[] not null default '{}' check (vibe_tags <@ array[
    'traditional_konkani_home', 'family', 'luxury', 'business', 'backpacker',
    'couple_friendly', 'pet_friendly', 'beachfront', 'orchard_stay'
  ]),
  service_style public.service_style,
  amenities jsonb not null default '{}',
  network_strength jsonb not null default '{}',
  food_at_stay jsonb not null default '{}',
  price_min integer check (price_min >= 0),
  price_max integer check (price_max >= price_min),
  price_source public.price_source,
  phone text,
  whatsapp text,
  is_verified boolean not null default false,
  owner_id uuid references auth.users (id),
  claimed_at timestamptz,
  status public.content_status not null default 'draft',
  last_verified_at timestamptz,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index on public.stays (taluka_id);
create index on public.stays using gist (location);

create table public.stay_translations (
  id uuid primary key default gen_random_uuid(),
  stay_id uuid not null references public.stays (id) on delete cascade,
  lang public.lang not null,
  name text not null,
  description text,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (stay_id, lang)
);

create table public.stay_offers (
  id uuid primary key default gen_random_uuid(),
  stay_id uuid not null references public.stays (id) on delete cascade,
  provider text not null,
  deep_link text not null,
  affiliate_network text check (affiliate_network in ('agoda_partners', 'inrdeals', 'cuelinks')),
  live_price integer,
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ---------------------------------------------------------------- eateries + dishes
create table public.eateries (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  taluka_id uuid not null references public.talukas (id),
  location extensions.geography(Point, 4326) not null,
  authenticity public.eatery_authenticity,
  price_for_two integer check (price_for_two >= 0),
  diet_flags jsonb not null default '{}',
  vibe_tags text[] not null default '{}',
  service_style public.service_style,
  food_apps jsonb not null default '{}',
  menu jsonb,
  owner_id uuid references auth.users (id),
  is_verified boolean not null default false,
  status public.content_status not null default 'draft',
  last_verified_at timestamptz,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index on public.eateries (taluka_id);
create index on public.eateries using gist (location);

create table public.eatery_translations (
  id uuid primary key default gen_random_uuid(),
  eatery_id uuid not null references public.eateries (id) on delete cascade,
  lang public.lang not null,
  name text not null,
  description text,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (eatery_id, lang)
);

create table public.eatery_hours (
  id uuid primary key default gen_random_uuid(),
  eatery_id uuid not null references public.eateries (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens time,
  closes time,
  hours_unknown boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index on public.eatery_hours (eatery_id);

create table public.dishes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.dish_translations (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references public.dishes (id) on delete cascade,
  lang public.lang not null,
  name text not null,
  what_it_is text,
  story text,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (dish_id, lang)
);

create table public.eatery_dishes (
  id uuid primary key default gen_random_uuid(),
  eatery_id uuid not null references public.eateries (id) on delete cascade,
  dish_id uuid not null references public.dishes (id) on delete cascade,
  is_signature boolean not null default false,
  is_best_for boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (eatery_id, dish_id)
);

-- ---------------------------------------------------------------- photos (verifier/owner-shot only)
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  entity_type public.listing_type not null,
  entity_id uuid not null,
  storage_path text not null,
  lqip text,
  width integer,
  height integer,
  uploaded_by uuid not null references auth.users (id),
  is_hero boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index on public.photos (entity_type, entity_id);

-- ---------------------------------------------------------------- owner claims (G5)
create table public.owner_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_type public.entity_type not null check (entity_type in ('stay', 'eatery')),
  entity_id uuid not null,
  email text not null,
  status public.review_status not null default 'pending',
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Listing helpers
-- ---------------------------------------------------------------------------
create function app.listing_taluka(_type public.listing_type, _id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select case _type
    when 'place' then (select taluka_id from public.places where id = _id)
    when 'stay' then (select taluka_id from public.stays where id = _id)
    when 'eatery' then (select taluka_id from public.eateries where id = _id)
  end;
$$;

create function app.listing_published(_type public.listing_type, _id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case _type
    when 'place' then exists (select 1 from public.places where id = _id and status = 'published')
    when 'stay' then exists (select 1 from public.stays where id = _id and status = 'published')
    when 'eatery' then exists (select 1 from public.eateries where id = _id and status = 'published')
    when 'dish' then exists (select 1 from public.dishes where id = _id)
  end;
$$;

-- Staff = admin, any reviewer, or a verifier of the listing's taluka (dishes: admin/reviewer).
create function app.is_staff_for(_type public.listing_type, _id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_admin()
    or app.has_role('reviewer')
    or (_type <> 'dish' and app.has_role('verifier', app.listing_taluka(_type, _id)));
$$;

create function app.can_read_listing(_type public.listing_type, _id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.listing_published(_type, _id) or app.is_staff_for(_type, _id);
$$;

-- Verifiers may not publish; only reviewers/admins move a row into 'published'.
create function app.guard_publish() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'published'
     and (tg_op = 'INSERT' or old.status is distinct from 'published')
     and auth.uid() is not null
     and not (app.is_admin() or app.has_role('reviewer')) then
    raise exception 'only reviewers can publish' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Owners may change fact fields only (prices, menu, contact). Timings/photos live in child tables.
create function app.guard_owner_stays() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and app.has_role('owner', 'stay', old.id) and not app.is_staff_for('stay', old.id)
     and (to_jsonb(new) - array['price_min', 'price_max', 'price_source', 'phone', 'whatsapp', 'updated_at'])
         is distinct from
         (to_jsonb(old) - array['price_min', 'price_max', 'price_source', 'phone', 'whatsapp', 'updated_at']) then
    raise exception 'owners can edit fact fields only' using errcode = '42501';
  end if;
  return new;
end;
$$;

create function app.guard_owner_eateries() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and app.has_role('owner', 'eatery', old.id) and not app.is_staff_for('eatery', old.id)
     and (to_jsonb(new) - array['price_for_two', 'menu', 'updated_at'])
         is distinct from
         (to_jsonb(old) - array['price_for_two', 'menu', 'updated_at']) then
    raise exception 'owners can edit fact fields only' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_publish before insert or update on public.places
  for each row execute function app.guard_publish();
create trigger guard_publish before insert or update on public.stays
  for each row execute function app.guard_publish();
create trigger guard_publish before insert or update on public.eateries
  for each row execute function app.guard_publish();
create trigger guard_owner before update on public.stays
  for each row execute function app.guard_owner_stays();
create trigger guard_owner before update on public.eateries
  for each row execute function app.guard_owner_eateries();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.places enable row level security;
alter table public.place_translations enable row level security;
alter table public.place_hours enable row level security;
alter table public.place_seasonal enable row level security;
alter table public.crowd_typical enable row level security;
alter table public.audio_guides enable row level security;
alter table public.place_embeddings enable row level security;
alter table public.verifier_notes enable row level security;
alter table public.stays enable row level security;
alter table public.stay_translations enable row level security;
alter table public.stay_offers enable row level security;
alter table public.eateries enable row level security;
alter table public.eatery_translations enable row level security;
alter table public.eatery_hours enable row level security;
alter table public.dishes enable row level security;
alter table public.dish_translations enable row level security;
alter table public.eatery_dishes enable row level security;
alter table public.photos enable row level security;
alter table public.owner_claims enable row level security;

-- Parent listings: published readable by all; staff read/write in scope; owners update own (guarded).
create policy "read" on public.places for select using (app.can_read_listing('place', id));
create policy "staff insert" on public.places for insert
  with check (app.is_admin() or app.has_role('reviewer') or app.has_role('verifier', taluka_id));
create policy "staff update" on public.places for update
  using (app.is_staff_for('place', id))
  with check (app.is_admin() or app.has_role('reviewer') or app.has_role('verifier', taluka_id));
create policy "admin delete" on public.places for delete using (app.is_admin());

create policy "read" on public.stays for select using (app.can_read_listing('stay', id));
create policy "staff insert" on public.stays for insert
  with check (app.is_admin() or app.has_role('reviewer') or app.has_role('verifier', taluka_id));
create policy "staff or owner update" on public.stays for update
  using (app.is_staff_for('stay', id) or app.has_role('owner', 'stay', id))
  with check (app.is_admin() or app.has_role('reviewer') or app.has_role('verifier', taluka_id)
              or app.has_role('owner', 'stay', id));
create policy "admin delete" on public.stays for delete using (app.is_admin());

create policy "read" on public.eateries for select using (app.can_read_listing('eatery', id));
create policy "staff insert" on public.eateries for insert
  with check (app.is_admin() or app.has_role('reviewer') or app.has_role('verifier', taluka_id));
create policy "staff or owner update" on public.eateries for update
  using (app.is_staff_for('eatery', id) or app.has_role('owner', 'eatery', id))
  with check (app.is_admin() or app.has_role('reviewer') or app.has_role('verifier', taluka_id)
              or app.has_role('owner', 'eatery', id));
create policy "admin delete" on public.eateries for delete using (app.is_admin());

create policy "read" on public.dishes for select using (true);
create policy "staff write" on public.dishes for all
  using (app.is_staff_for('dish', id)) with check (app.is_staff_for('dish', id));

-- Child tables: read follows parent; write = staff for parent (owners also for timings).
create policy "read" on public.place_translations for select using (app.can_read_listing('place', place_id));
create policy "staff write" on public.place_translations for all
  using (app.is_staff_for('place', place_id)) with check (app.is_staff_for('place', place_id));
create policy "read" on public.place_hours for select using (app.can_read_listing('place', place_id));
create policy "staff write" on public.place_hours for all
  using (app.is_staff_for('place', place_id)) with check (app.is_staff_for('place', place_id));
create policy "read" on public.place_seasonal for select using (app.can_read_listing('place', place_id));
create policy "staff write" on public.place_seasonal for all
  using (app.is_staff_for('place', place_id)) with check (app.is_staff_for('place', place_id));
create policy "read" on public.crowd_typical for select using (app.can_read_listing('place', place_id));
create policy "staff write" on public.crowd_typical for all
  using (app.is_staff_for('place', place_id)) with check (app.is_staff_for('place', place_id));
create policy "read" on public.audio_guides for select using (app.can_read_listing('place', place_id));
create policy "staff write" on public.audio_guides for all
  using (app.is_staff_for('place', place_id)) with check (app.is_staff_for('place', place_id));
create policy "read" on public.place_embeddings for select using (app.can_read_listing('place', place_id));
create policy "admin write" on public.place_embeddings for all using (app.is_admin()) with check (app.is_admin());
create policy "staff all" on public.verifier_notes for all
  using (app.is_staff_for('place', place_id)) with check (app.is_staff_for('place', place_id));

create policy "read" on public.stay_translations for select using (app.can_read_listing('stay', stay_id));
create policy "staff write" on public.stay_translations for all
  using (app.is_staff_for('stay', stay_id)) with check (app.is_staff_for('stay', stay_id));
create policy "read" on public.stay_offers for select using (app.can_read_listing('stay', stay_id));
create policy "admin write" on public.stay_offers for all using (app.is_admin()) with check (app.is_admin());

create policy "read" on public.eatery_translations for select using (app.can_read_listing('eatery', eatery_id));
create policy "staff write" on public.eatery_translations for all
  using (app.is_staff_for('eatery', eatery_id)) with check (app.is_staff_for('eatery', eatery_id));
create policy "read" on public.eatery_hours for select using (app.can_read_listing('eatery', eatery_id));
create policy "staff or owner write" on public.eatery_hours for all
  using (app.is_staff_for('eatery', eatery_id) or app.has_role('owner', 'eatery', eatery_id))
  with check (app.is_staff_for('eatery', eatery_id) or app.has_role('owner', 'eatery', eatery_id));
create policy "read" on public.eatery_dishes for select using (app.can_read_listing('eatery', eatery_id));
create policy "staff or owner write" on public.eatery_dishes for all
  using (app.is_staff_for('eatery', eatery_id) or app.has_role('owner', 'eatery', eatery_id))
  with check (app.is_staff_for('eatery', eatery_id) or app.has_role('owner', 'eatery', eatery_id));

create policy "read" on public.dish_translations for select using (true);
create policy "staff write" on public.dish_translations for all
  using (app.is_staff_for('dish', dish_id)) with check (app.is_staff_for('dish', dish_id));

create policy "read" on public.photos for select using (app.can_read_listing(entity_type, entity_id));
create policy "staff or owner write" on public.photos for all
  using (app.is_staff_for(entity_type, entity_id) or app.has_role('owner', entity_type, entity_id))
  with check (uploaded_by = auth.uid()
              and (app.is_staff_for(entity_type, entity_id) or app.has_role('owner', entity_type, entity_id)));

create policy "own read" on public.owner_claims for select using (user_id = auth.uid() or app.is_admin());
create policy "own insert" on public.owner_claims for insert
  with check (user_id = auth.uid() and status = 'pending' and reviewed_by is null);
create policy "admin update" on public.owner_claims for update using (app.is_admin()) with check (app.is_admin());
