-- Regions and talukas (region lives in data, never in code)
create table public.regions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code_prefix text not null unique check (code_prefix ~ '^[A-Z]{2,5}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.talukas (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions (id),
  name_en text not null,
  name_hi text not null,
  name_mr text not null,
  boundary extensions.geography(MultiPolygon, 4326),
  pack_url text,
  pack_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (region_id, name_en)
);

-- Profiles (auto-created on signup). Roles live in user_roles, not here.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  language public.lang not null default 'en',
  theme public.theme not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- A user can hold several roles, each optionally scoped to a taluka or a listing.
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  taluka_id uuid references public.talukas (id),
  entity_type public.listing_type,
  entity_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  check ((entity_type is null) = (entity_id is null)),
  unique nulls not distinct (user_id, role, taluka_id, entity_type, entity_id)
);
create index on public.user_roles (user_id);

create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  diet text check (diet in ('veg', 'non_veg', 'jain')),
  budget_level text,
  group_type public.group_type,
  past_trip_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create type public.consent_type as enum ('dwell_time', 'push', 'ai_processing');
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type public.consent_type not null,
  granted boolean not null,
  granted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (user_id, type)
);

-- ---------------------------------------------------------------------------
-- Role helpers. Security definer so policies can call them without recursion.
-- A role row with null taluka_id applies to every taluka.
-- ---------------------------------------------------------------------------
create function app.has_role(_role public.app_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = _role
  );
$$;

create function app.has_role(_role public.app_role, _taluka uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = _role
      and (taluka_id is null or taluka_id = _taluka)
  );
$$;

create function app.has_role(_role public.app_role, _type public.listing_type, _id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = _role
      and entity_type = _type and entity_id = _id
  );
$$;

create function app.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select app.has_role('admin');
$$;

-- Create a profile for every new auth user
create function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- RLS
alter table public.regions enable row level security;
alter table public.talukas enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.consents enable row level security;

create policy "public read" on public.regions for select using (true);
create policy "admin write" on public.regions for all using (app.is_admin()) with check (app.is_admin());
create policy "public read" on public.talukas for select using (true);
create policy "admin write" on public.talukas for all using (app.is_admin()) with check (app.is_admin());

create policy "own read" on public.profiles for select using (id = auth.uid() or app.is_admin());
create policy "own update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "own read" on public.user_roles for select using (user_id = auth.uid() or app.is_admin());
create policy "admin write" on public.user_roles for all using (app.is_admin()) with check (app.is_admin());

create policy "own all" on public.user_preferences for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own all" on public.consents for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
