-- Hardening 2026-11, SEC-16: security events (gate, limiter, AI budget, CSP, quotas) and an admin audit trail.

-- ---------------------------------------------------------------- security events
-- Written by the web server only (log_security_event, service role); read on /admin/security with the service
-- client. client_key is the limiter's HMAC of the IP (never an IP); detail holds no emails, passcodes or secrets.
create table public.security_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  kind text not null check (char_length(kind) between 1 and 60),
  client_key text check (client_key ~ '^[0-9a-f]{64}$'),
  detail jsonb check (pg_column_size(detail) <= 4096)
);
create index on public.security_events (at desc);
alter table public.security_events enable row level security;

create function public.log_security_event(_kind text, _client_key text default null, _detail jsonb default null)
returns void
language sql security definer set search_path = '' as $$
  insert into public.security_events (kind, client_key, detail) values (_kind, _client_key, _detail);
$$;
revoke all on function public.log_security_event(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.log_security_event(text, text, jsonb) to service_role;

-- 90 days, then gone (nightly, 03:20 IST).
select cron.schedule('security-events-purge', '50 21 * * *',
  $$delete from public.security_events where at < now() - interval '90 days'$$);

-- ---------------------------------------------------------------- admin audit
create table public.admin_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor text check (char_length(actor) <= 64),
  entity_type text not null,
  entity_id uuid not null,
  action text not null check (char_length(action) <= 60),
  diff jsonb check (pg_column_size(diff) <= 8192)
);
create index on public.admin_audit (entity_type, entity_id, at desc);
alter table public.admin_audit enable row level security;

-- Body as in 20261107100000_team_table_atomic_save.sql plus the audit row at the end (same transaction).
create or replace function public.admin_apply_save(_type public.listing_type, _id uuid, _version timestamptz, _plan jsonb)
returns timestamptz
language plpgsql set search_path = '' as $function$
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

  -- SEC-16: one audit row per save. Which parts changed (keys only, never values: private fields stay out),
  -- and who, as a SHA-256 of the editor's email (never the email itself).
  insert into public.admin_audit (actor, entity_type, entity_id, action, diff)
  values (
    encode(extensions.digest(lower(coalesce(_plan -> 'team' ->> 'last_edited_by', '')), 'sha256'), 'hex'),
    _type::text, _id,
    case when rowp ? 'status' then 'status:' || (rowp ->> 'status') else 'save' end,
    jsonb_strip_nulls(jsonb_build_object(
      'row', (select jsonb_agg(k order by k) from jsonb_object_keys(rowp) k),
      'tr', (select jsonb_agg(distinct x ->> 'lang') from jsonb_array_elements(coalesce(_plan -> 'tr', '[]')) x),
      'form', case when jsonb_typeof(_plan -> 'form') = 'object'
                   then (select jsonb_agg(k order by k) from jsonb_object_keys(_plan -> 'form') k) end,
      'private', case when _plan ? 'private' then to_jsonb(true) end,
      'children', (select jsonb_agg(x ->> 'table') from jsonb_array_elements(coalesce(_plan -> 'children', '[]')) x)
    ))
  );

  return v;
end;
$function$;
