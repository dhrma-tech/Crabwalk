-- Admin data editing (user 2026-11-06, ADMIN_ACCESS_CHANGES.md). Additive only: new columns, two staff-only
-- tables, tighter read policies for archived dishes and hidden review photos, and two service-role helpers.
-- The field forms (Drive: "Crabwalk Field Form - Places / Stays and Hotels / Food") are the template:
-- IDs, required fields and choice lists come from there.

-- ---------------------------------------------------------------- listing columns
-- code: the field-form ID (<REGION>-P-001, <REGION>-S-001, <REGION>-F-001, DISH-001). The region prefix is
-- data (regions.code_prefix); the app checks it against the listing's taluka.
-- verified_by / reviewed_by hold the team member (temp mode: the admin's email); verified_on = last_verified_at.
-- archived_at hides a row from the public site (status goes to draft); archived_status restores it.
alter table public.places
  add column code text unique check (code ~ '^[A-Z]{2,5}-P-[0-9]{3}$'),
  add column verified_by text check (char_length(verified_by) <= 254),
  add column reviewed_by text check (char_length(reviewed_by) <= 254),
  add column reviewed_on date,
  add column last_edited_by text check (char_length(last_edited_by) <= 254),
  add column last_edited_at timestamptz,
  add column archived_at timestamptz,
  add column archived_status public.content_status;

alter table public.stays
  add column code text unique check (code ~ '^[A-Z]{2,5}-S-[0-9]{3}$'),
  add column verified_by text check (char_length(verified_by) <= 254),
  add column reviewed_by text check (char_length(reviewed_by) <= 254),
  add column reviewed_on date,
  add column next_recheck_at timestamptz,
  add column last_edited_by text check (char_length(last_edited_by) <= 254),
  add column last_edited_at timestamptz,
  add column archived_at timestamptz,
  add column archived_status public.content_status;

alter table public.eateries
  add column code text unique check (code ~ '^[A-Z]{2,5}-F-[0-9]{3}$'),
  add column verified_by text check (char_length(verified_by) <= 254),
  add column reviewed_by text check (char_length(reviewed_by) <= 254),
  add column reviewed_on date,
  add column next_recheck_at timestamptz,
  add column last_edited_by text check (char_length(last_edited_by) <= 254),
  add column last_edited_at timestamptz,
  add column archived_at timestamptz,
  add column archived_status public.content_status;

-- Dishes had no workflow: existing rows stay published (public), new ones start as drafts in the editor.
alter table public.dishes
  add column code text unique check (code ~ '^DISH-[0-9]{3}$'),
  add column status public.content_status not null default 'published',
  add column verified_by text check (char_length(verified_by) <= 254),
  add column last_verified_at timestamptz,
  add column reviewed_by text check (char_length(reviewed_by) <= 254),
  add column reviewed_on date,
  add column last_edited_by text check (char_length(last_edited_by) <= 254),
  add column last_edited_at timestamptz,
  add column archived_at timestamptz,
  add column archived_status public.content_status;

-- Photo slots from the field forms (hero, card, gallery, cover, rooms, …), their order and the form file name.
alter table public.photos
  add column slot text check (slot in (
    'hero', 'card', 'gallery', 'cover', 'rooms', 'bathroom', 'outside', 'food', 'dishes', 'inside', 'menu', 'dish')),
  add column sort_order smallint not null default 0,
  add column file_name text check (char_length(file_name) <= 120);

-- "Why here?" on a dish ↔ eatery link (Food form, dish "Where it's best").
alter table public.eatery_dishes add column note text check (char_length(note) <= 300);

-- Moderators hide an abusive review photo without deleting it.
alter table public.review_photos add column hidden_at timestamptz;

-- ---------------------------------------------------------------- read policies (tighter, never looser)
create or replace function app.listing_published(_type public.listing_type, _id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case _type
    when 'place' then exists (select 1 from public.places where id = _id and status = 'published')
    when 'stay' then exists (select 1 from public.stays where id = _id and status = 'published')
    when 'eatery' then exists (select 1 from public.eateries where id = _id and status = 'published')
    when 'dish' then exists (select 1 from public.dishes where id = _id and status = 'published')
  end;
$$;

drop policy "read" on public.dishes;
create policy "read" on public.dishes for select using (status = 'published' or app.is_staff_for('dish', id));
drop policy "read" on public.dish_translations;
create policy "read" on public.dish_translations for select using (app.can_read_listing('dish', dish_id));

drop policy "read with review" on public.review_photos;
create policy "read with review" on public.review_photos for select
  using (exists (select 1 from public.reviews r where r.id = review_id)  -- reviews RLS decides
         and (hidden_at is null or user_id = auth.uid() or app.has_role('reviewer') or app.is_admin()));

-- ---------------------------------------------------------------- staff-only tables (service role only)
-- Field-form answers with no column of their own (village, audio points, room types, menu items, …).
-- No policies: only the service role (admin server routes) reads or writes. Never shown in the app.
create table public.listing_form (
  entity_type public.listing_type not null,
  entity_id uuid not null,
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  primary key (entity_type, entity_id)
);
-- Private fields from the forms: owner's own phone (owner claim only), team-only notes, who told us.
create table public.listing_private (
  entity_type public.listing_type not null,
  entity_id uuid not null,
  owner_phone text check (owner_phone ~ '^[0-9]{10}$'),
  internal_notes text check (char_length(internal_notes) <= 4000),
  source_notes text check (char_length(source_notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  primary key (entity_type, entity_id)
);
create trigger set_updated_at before update on public.listing_form
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.listing_private
  for each row execute function app.set_updated_at();
alter table public.listing_form enable row level security;
alter table public.listing_private enable row level security;
revoke all on public.listing_form, public.listing_private from anon, authenticated;

-- ---------------------------------------------------------------- service-role helpers
-- Delete forever: the listing, its child rows (FK cascade) and every row that points at it by entity_id
-- (photos, QR codes + their scans and reports, ratings, saves, trip stops, roles, …). Pipeline matrix points
-- are left alone. The server removes the storage files first. Service role only.
create function public.admin_delete_listing(_type public.listing_type, _id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare t record;
begin
  delete from public.reports where photo_id in (select id from public.photos where entity_id = _id)
    or qr_code in (select code from public.qr_codes where entity_id = _id);
  delete from public.qr_scans where code in (select code from public.qr_codes where entity_id = _id);
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables x on x.table_schema = c.table_schema and x.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'entity_id' and x.table_type = 'BASE TABLE'
      and c.table_name <> 'matrix_points'
  loop
    execute format('delete from public.%I where entity_id = $1', t.table_name) using _id;
  end loop;
  execute format('delete from public.%I where id = $1',
    case _type when 'place' then 'places' when 'stay' then 'stays' when 'eatery' then 'eateries' else 'dishes' end)
    using _id;
end;
$$;
revoke execute on function public.admin_delete_listing from public, anon, authenticated;
grant execute on function public.admin_delete_listing to service_role;

-- Column list for the generic admin table editor (forms built from the schema). Service role only.
create function public.admin_table_columns(_table text)
returns table (column_name text, data_type text, udt_name text, nullable boolean, has_default boolean, enum_values text[])
language sql stable security definer set search_path = '' as $$
  select c.column_name::text, c.data_type::text, c.udt_name::text, c.is_nullable = 'YES', c.column_default is not null,
    (select array_agg(e.enumlabel::text order by e.enumsortorder)
       from pg_catalog.pg_type ty
       join pg_catalog.pg_enum e on e.enumtypid = ty.oid
       join pg_catalog.pg_namespace n on n.oid = ty.typnamespace
      where ty.typname = c.udt_name and n.nspname = 'public')
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = _table
  order by c.ordinal_position;
$$;
revoke execute on function public.admin_table_columns from public, anon, authenticated;
grant execute on function public.admin_table_columns to service_role;
