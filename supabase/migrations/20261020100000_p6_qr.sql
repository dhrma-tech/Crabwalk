-- P6: QR short codes, scans, GPS-verified visits, "Near me now" (BACKEND §9).

insert into public.app_config (key, value, notes) values
  ('qr_visit_radius_m', '200', 'P6: max server-computed distance for a QR + GPS verified visit');

-- Location of whatever a code points at (places/stays/eateries, or station/bus-stand utility POIs).
create function app.qr_entity_location(_type public.qr_entity_type, _id uuid) returns extensions.geography
language sql stable security definer set search_path = '' as $$
  select case _type
    when 'place' then (select location from public.places where id = _id)
    when 'stay' then (select location from public.stays where id = _id)
    when 'eatery' then (select location from public.eateries where id = _id)
    else (select location from public.utility_pois where id = _id)
  end;
$$;

-- ---------------------------------------------------------------- short code generator (PLAN P6 task 1)
-- <region prefix>-<n>, n zero-padded to 3 (RTN-001…). Prefix comes from regions.code_prefix (B8).
create function public.create_qr_code(_type public.qr_entity_type, _id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  prefix text;
  n integer;
  c text;
begin
  if not app.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if _type in ('station', 'bus_stand') and not exists (
    select 1 from public.utility_pois where id = _id
      and type = case _type when 'station' then 'railway_station'::public.utility_type else 'bus_stand'::public.utility_type end
  ) then
    raise exception 'not a % point', _type using errcode = '23503';
  end if;
  select r.code_prefix into prefix
  from public.talukas t join public.regions r on r.id = t.region_id
  where t.id = app.report_taluka(_type, _id);
  if prefix is null then
    raise exception 'entity has no taluka/region' using errcode = '23503';
  end if;
  perform pg_advisory_xact_lock(hashtext('qr:' || prefix));
  select coalesce(max(split_part(code, '-', 2)::integer), 0) + 1 into n
  from public.qr_codes where split_part(code, '-', 1) = prefix;
  c := prefix || '-' || lpad(n::text, 3, '0');
  insert into public.qr_codes (code, entity_type, entity_id) values (c, _type, _id);
  return c;
end;
$$;
revoke execute on function public.create_qr_code from anon;

-- ---------------------------------------------------------------- scans (feed live crowd + heatmap)
-- Anonymous: session_hash = SHA-256 of a 1-day random cookie (DECISIONS P6-4). One row per session/code/10 min.
create function public.qr_record_scan(
  _code text, _session_hash text, _lang public.lang default null,
  _lat float8 default null, _lng float8 default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if _session_hash is null or _session_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'bad session' using errcode = '22023';
  end if;
  if (_lat is null) <> (_lng is null) or _lat not between -90 and 90 or _lng not between -180 and 180 then
    raise exception 'bad position' using errcode = '22023';
  end if;
  if not exists (select 1 from public.qr_codes where code = _code) then
    return;
  end if;
  if exists (select 1 from public.qr_scans where code = _code and session_hash = _session_hash
             and scanned_at > now() - interval '10 minutes') then
    return;
  end if;
  insert into public.qr_scans (code, lang, session_hash, lat, lng) values (_code, _lang, _session_hash, _lat, _lng);
end;
$$;

-- ---------------------------------------------------------------- verified visit (PLAN P6 task 3)
-- Distance is computed here from the listing location; the client only sends its position.
create function public.qr_verify_visit(_code text, _lat float8, _lng float8)
returns table (verified boolean, distance_m integer)
language plpgsql security definer set search_path = '' as $$
declare
  q public.qr_codes;
  d integer;
  r integer := (select value::integer from public.app_config where key = 'qr_visit_radius_m');
begin
  if auth.uid() is null then
    raise exception 'sign in' using errcode = '42501';
  end if;
  if _lat is null or _lng is null or _lat not between -90 and 90 or _lng not between -180 and 180 then
    raise exception 'bad position' using errcode = '22023';
  end if;
  select * into q from public.qr_codes where code = _code;
  if not found or q.entity_type not in ('place', 'stay', 'eatery') then
    raise exception 'no listing for code' using errcode = 'P0002';
  end if;
  d := round(extensions.st_distance(
    app.qr_entity_location(q.entity_type, q.entity_id),
    extensions.st_setsrid(extensions.st_makepoint(_lng, _lat), 4326)::extensions.geography));
  if d is null then
    raise exception 'no listing for code' using errcode = 'P0002';
  end if;
  if d <= r and not exists (
    select 1 from public.verified_visits v
    where v.user_id = auth.uid() and v.entity_type = q.entity_type::text::public.entity_type
      and v.entity_id = q.entity_id and v.method = 'qr_gps' and v.created_at > now() - interval '1 day'
  ) then
    insert into public.verified_visits (user_id, entity_type, entity_id, method, distance_m)
    values (auth.uid(), q.entity_type::text::public.entity_type, q.entity_id, 'qr_gps', d);
  end if;
  return query select d <= r, d;
end;
$$;
revoke execute on function public.qr_verify_visit from anon;

-- ---------------------------------------------------------------- Near me now (BACKEND §9)
-- Nearest 2 stays, 2 eateries, 1 each of fuel/ATM/toilet/hospital (PostGIS KNN, straight line) and the
-- next 3 places by corrected road time from the travel matrix (straight-line fallback when not in it).
create function public.qr_near_me(_code text)
returns table (
  kind text, sub text, slug text, name_en text, name_hi text, name_mr text,
  distance_m integer, minutes integer, phone text
)
language sql stable security invoker set search_path = '' as $$
  with q as (select entity_type, entity_id from public.qr_codes where code = _code),
  here as (select app.qr_entity_location(q.entity_type, q.entity_id) g, q.entity_type, q.entity_id from q),
  road as (
    select p.slug, p.id, tm.distance_m, tm.duration_corrected_s
    from here
    join public.matrix_points mp on mp.entity_type::text = here.entity_type::text and mp.entity_id = here.entity_id
    join public.travel_matrix tm on tm.from_point_id = mp.id
    join public.matrix_points p2 on p2.id = tm.to_point_id and p2.entity_type = 'place'
    join public.places p on p.id = p2.entity_id and p.status = 'published'
    order by tm.duration_corrected_s
    limit 3
  )
  (select 'stay', null::text, s.slug,
     (select t.name from public.stay_translations t where t.stay_id = s.id and t.lang = 'en'),
     (select t.name from public.stay_translations t where t.stay_id = s.id and t.lang = 'hi'),
     (select t.name from public.stay_translations t where t.stay_id = s.id and t.lang = 'mr'),
     round(extensions.st_distance(s.location, here.g))::integer, null::integer, null::text
   from public.stays s, here
   where s.status = 'published' and not (here.entity_type = 'stay' and s.id = here.entity_id)
   order by s.location operator(extensions.<->) here.g limit 2)
  union all
  (select 'eatery', null, e.slug,
     (select t.name from public.eatery_translations t where t.eatery_id = e.id and t.lang = 'en'),
     (select t.name from public.eatery_translations t where t.eatery_id = e.id and t.lang = 'hi'),
     (select t.name from public.eatery_translations t where t.eatery_id = e.id and t.lang = 'mr'),
     round(extensions.st_distance(e.location, here.g))::integer, null, null
   from public.eateries e, here
   where e.status = 'published' and not (here.entity_type = 'eatery' and e.id = here.entity_id)
   order by e.location operator(extensions.<->) here.g limit 2)
  union all
  select 'utility', u.type::text, null, u.name, null, null,
    round(extensions.st_distance(u.location, here.g))::integer, null,
    case when u.type = 'hospital' then u.phone end
  from here, unnest(array['fuel', 'atm', 'toilet', 'hospital']::public.utility_type[]) ut(t)
  cross join lateral (
    select * from public.utility_pois x where x.type = ut.t
    order by x.location operator(extensions.<->) here.g limit 1
  ) u
  union all
  select 'place', null, r.slug,
    (select t.name from public.place_translations t where t.place_id = r.id and t.lang = 'en'),
    (select t.name from public.place_translations t where t.place_id = r.id and t.lang = 'hi'),
    (select t.name from public.place_translations t where t.place_id = r.id and t.lang = 'mr'),
    r.distance_m, round(r.duration_corrected_s / 60.0)::integer, null
  from road r
  union all
  (select 'place', null, p.slug,
     (select t.name from public.place_translations t where t.place_id = p.id and t.lang = 'en'),
     (select t.name from public.place_translations t where t.place_id = p.id and t.lang = 'hi'),
     (select t.name from public.place_translations t where t.place_id = p.id and t.lang = 'mr'),
     round(extensions.st_distance(p.location, here.g))::integer, null, null
   from public.places p, here
   where p.status = 'published' and not (here.entity_type = 'place' and p.id = here.entity_id)
     and not exists (select 1 from road)
   order by p.location operator(extensions.<->) here.g limit 3);
$$;

-- Printed codes are permanent: never deleted from clients (a deleted top number would be re-issued).
revoke delete on public.qr_codes from anon, authenticated;
