-- Go-live hardening for the admin editor (user 2026-11-07, ADMIN_ACCESS_CHANGES.md).
-- 1. Team names / emails leave the public listing rows: RLS is row-level, so any column on a published row was
--    readable through the REST API. They move to listing_team (staff-only, service role only).
-- 2. admin_apply_save: one editor save = one transaction (listing row with version check, team row,
--    translations, form answers, private fields, child rows). All or nothing.
-- 3. gate_attempts: temporary admin gate lockout (10 failed tries from one client → locked for 1 hour).
-- 4. Value mapping (docs/VALUE_MAPPING.md): phones in the forms' format, 10 digits.

-- ---------------------------------------------------------------- 1. listing_team
create table public.listing_team (
  entity_type public.listing_type not null,
  entity_id uuid not null,
  verified_by text check (char_length(verified_by) <= 254),
  reviewed_by text check (char_length(reviewed_by) <= 254),
  last_edited_by text check (char_length(last_edited_by) <= 254),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  primary key (entity_type, entity_id)
);
create trigger set_updated_at before update on public.listing_team
  for each row execute function app.set_updated_at();
alter table public.listing_team enable row level security;
revoke all on public.listing_team from anon, authenticated;

insert into public.listing_team (entity_type, entity_id, verified_by, reviewed_by, last_edited_by)
select 'place'::public.listing_type, id, verified_by, reviewed_by, last_edited_by from public.places
  where coalesce(verified_by, reviewed_by, last_edited_by) is not null
union all
select 'stay', id, verified_by, reviewed_by, last_edited_by from public.stays
  where coalesce(verified_by, reviewed_by, last_edited_by) is not null
union all
select 'eatery', id, verified_by, reviewed_by, last_edited_by from public.eateries
  where coalesce(verified_by, reviewed_by, last_edited_by) is not null
union all
select 'dish', id, verified_by, reviewed_by, last_edited_by from public.dishes
  where coalesce(verified_by, reviewed_by, last_edited_by) is not null;

-- Added by 20261106130000 (never pushed live); moved above.
alter table public.places drop column verified_by, drop column reviewed_by, drop column last_edited_by;
alter table public.stays drop column verified_by, drop column reviewed_by, drop column last_edited_by;
alter table public.eateries drop column verified_by, drop column reviewed_by, drop column last_edited_by;
alter table public.dishes drop column verified_by, drop column reviewed_by, drop column last_edited_by;

-- ---------------------------------------------------------------- 2. atomic editor save
-- _plan (built by lib/server/content.ts after validation):
--   row       {column: value}           listing row patch (jsonb_populate_record casts each value)
--   team      {verified_by, reviewed_by, last_edited_by}  full values (upsert)
--   tr        [{lang, delete: true} | {lang, values: {field: value}}]
--   form      {…}                       full listing_form.data (upsert)
--   private   {owner_phone, internal_notes, source_notes}  full values (upsert)
--   children  [{table, key, rows: [...]}]  replace the set (whitelisted tables only)
-- The listing row is updated only if updated_at still equals _version; otherwise SQLSTATE 40001 and nothing
-- is written. Any error rolls back every part. Service role only.
create function public.admin_apply_save(_type public.listing_type, _id uuid, _version timestamptz, _plan jsonb)
returns timestamptz
language plpgsql security invoker set search_path = '' as $$
declare
  tbl text := case _type when 'place' then 'places' when 'stay' then 'stays' when 'eatery' then 'eateries' else 'dishes' end;
  trt text := _type::text || '_translations';
  fk text := _type::text || '_id';
  rowp jsonb := coalesce(_plan -> 'row', '{}');
  sets text;
  cols text;
  sel text;
  upd text;
  v timestamptz;
  t jsonb;
  c jsonb;
begin
  if exists (select 1 from jsonb_object_keys(rowp) k where k in ('id', 'created_at', 'updated_at')) then
    raise exception 'read-only column in save' using errcode = '22023';
  end if;
  select string_agg(format('%I = r.%I', k, k), ', ') into sets from jsonb_object_keys(rowp) k;
  execute format(
    'update public.%I x set %s from jsonb_populate_record(null::public.%I, $1) r
     where x.id = $2 and x.updated_at is not distinct from $3 returning x.updated_at',
    tbl, coalesce(sets || ', ', '') || 'updated_at = now()', tbl)
    into v using rowp, _id, _version;
  if v is null then
    raise exception 'version conflict' using errcode = '40001';
  end if;

  if _plan ? 'team' then
    insert into public.listing_team (entity_type, entity_id, verified_by, reviewed_by, last_edited_by)
    values (_type, _id, _plan -> 'team' ->> 'verified_by', _plan -> 'team' ->> 'reviewed_by',
            _plan -> 'team' ->> 'last_edited_by')
    on conflict (entity_type, entity_id) do update
      set verified_by = excluded.verified_by, reviewed_by = excluded.reviewed_by,
          last_edited_by = excluded.last_edited_by;
  end if;

  for t in select * from jsonb_array_elements(coalesce(_plan -> 'tr', '[]')) loop
    if (t ->> 'delete')::boolean then
      execute format('delete from public.%I where %I = $1 and lang = $2::public.lang', trt, fk)
        using _id, t ->> 'lang';
    else
      select string_agg(format('%I', k), ', '), string_agg(format('r.%I', k), ', '),
             string_agg(format('%I = excluded.%I', k, k), ', ')
        into cols, sel, upd
        from jsonb_object_keys(t -> 'values') k;
      execute format(
        'insert into public.%I (%I, lang, %s) select $1, $2::public.lang, %s
         from jsonb_populate_record(null::public.%I, $3) r
         on conflict (%I, lang) do update set %s',
        trt, fk, cols, sel, trt, fk, upd)
        using _id, t ->> 'lang', t -> 'values';
    end if;
  end loop;

  if _plan ? 'form' then
    insert into public.listing_form (entity_type, entity_id, data) values (_type, _id, _plan -> 'form')
    on conflict (entity_type, entity_id) do update set data = excluded.data;
  end if;

  if _plan ? 'private' then
    insert into public.listing_private (entity_type, entity_id, owner_phone, internal_notes, source_notes)
    values (_type, _id, _plan -> 'private' ->> 'owner_phone', _plan -> 'private' ->> 'internal_notes',
            _plan -> 'private' ->> 'source_notes')
    on conflict (entity_type, entity_id) do update
      set owner_phone = excluded.owner_phone, internal_notes = excluded.internal_notes,
          source_notes = excluded.source_notes;
  end if;

  for c in select * from jsonb_array_elements(coalesce(_plan -> 'children', '[]')) loop
    if not ((_type::text, c ->> 'table', c ->> 'key') in (
      ('place', 'place_hours', 'place_id'), ('place', 'place_seasonal', 'place_id'),
      ('place', 'crowd_typical', 'place_id'), ('stay', 'stay_offers', 'stay_id'),
      ('eatery', 'eatery_hours', 'eatery_id'), ('eatery', 'eatery_dishes', 'eatery_id'),
      ('dish', 'eatery_dishes', 'dish_id'))) then
      raise exception 'child table % not allowed for %', c ->> 'table', _type using errcode = '22023';
    end if;
    execute format('delete from public.%I where %I = $1', c ->> 'table', c ->> 'key') using _id;
    if jsonb_array_length(coalesce(c -> 'rows', '[]')) > 0 then
      select string_agg(format('%I', k), ', '), string_agg(format('r.%I', k), ', ') into cols, sel
        from jsonb_object_keys(c -> 'rows' -> 0) k;
      execute format('insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I, $1) r',
        c ->> 'table', cols, sel, c ->> 'table')
        using c -> 'rows';
    end if;
  end loop;

  return v;
end;
$$;
revoke execute on function public.admin_apply_save from public, anon, authenticated;
grant execute on function public.admin_apply_save to service_role;

-- ---------------------------------------------------------------- 3. admin gate lockout
-- One row per client key (HMAC of the IP, never the IP). 10 failures within an hour lock the key for an hour;
-- a successful sign-in clears it. Service role only.
create table public.gate_attempts (
  key text primary key,
  fails integer not null default 0,
  first_fail_at timestamptz not null default now(),
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create trigger set_updated_at before update on public.gate_attempts
  for each row execute function app.set_updated_at();
alter table public.gate_attempts enable row level security;
revoke all on public.gate_attempts from anon, authenticated;

create function public.gate_locked(_key text) returns timestamptz
language sql stable security invoker set search_path = '' as $$
  select locked_until from public.gate_attempts where key = _key and locked_until > now();
$$;

create function public.gate_record(_key text, _ok boolean) returns timestamptz
language plpgsql security invoker set search_path = '' as $$
declare r public.gate_attempts;
begin
  if _ok then
    delete from public.gate_attempts where key = _key;
    return null;
  end if;
  insert into public.gate_attempts as g (key, fails, first_fail_at) values (_key, 1, now())
  on conflict (key) do update set
    fails = case when g.first_fail_at < now() - interval '1 hour' and coalesce(g.locked_until, '-infinity') < now()
                 then 1 else g.fails + 1 end,
    first_fail_at = case when g.first_fail_at < now() - interval '1 hour' and coalesce(g.locked_until, '-infinity') < now()
                 then now() else g.first_fail_at end
  returning * into r;
  if r.fails >= 10 and coalesce(r.locked_until, '-infinity') < now() then
    update public.gate_attempts set locked_until = now() + interval '1 hour' where key = _key
      returning * into r;
  end if;
  return case when r.locked_until > now() then r.locked_until end;
end;
$$;
revoke execute on function public.gate_locked, public.gate_record from public, anon, authenticated;
grant execute on function public.gate_locked, public.gate_record to service_role;

-- ---------------------------------------------------------------- 4. phones: 10 digits (field forms)
-- "+91 95036 35969" → "9503635969", "+91 2355 352503" → "2355352503". Only values that reduce to exactly 10
-- digits change; links add +91 again (lib/phone.ts).
update public.stays set phone = regexp_replace(regexp_replace(phone, '\D', '', 'g'), '^(?:91|0)(\d{10})$', '\1')
  where phone is not null and phone !~ '^\d{10}$'
    and length(regexp_replace(regexp_replace(phone, '\D', '', 'g'), '^(?:91|0)(\d{10})$', '\1')) = 10;
update public.stays set whatsapp = regexp_replace(regexp_replace(whatsapp, '\D', '', 'g'), '^(?:91|0)(\d{10})$', '\1')
  where whatsapp is not null and whatsapp !~ '^\d{10}$'
    and length(regexp_replace(regexp_replace(whatsapp, '\D', '', 'g'), '^(?:91|0)(\d{10})$', '\1')) = 10;
update public.eateries set phone = regexp_replace(regexp_replace(phone, '\D', '', 'g'), '^(?:91|0)(\d{10})$', '\1')
  where phone is not null and phone !~ '^\d{10}$'
    and length(regexp_replace(regexp_replace(phone, '\D', '', 'g'), '^(?:91|0)(\d{10})$', '\1')) = 10;
update public.eateries set whatsapp = regexp_replace(regexp_replace(whatsapp, '\D', '', 'g'), '^(?:91|0)(\d{10})$', '\1')
  where whatsapp is not null and whatsapp !~ '^\d{10}$'
    and length(regexp_replace(regexp_replace(whatsapp, '\D', '', 'g'), '^(?:91|0)(\d{10})$', '\1')) = 10;
