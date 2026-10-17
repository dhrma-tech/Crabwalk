-- P3: weather points (data), context crons (pg_cron → Edge Functions), map RPCs.

-- ---------------------------------------------------------------- weather points (DECISIONS P3-4)
-- 9 taluka HQs + 9 coastal spots + 2 ghat approaches. Coordinates = OSM place nodes (ghats: road extents).
-- Region-specific rows are data, not logic; team to review.
insert into public.weather_points (name, location)
select name, extensions.st_setsrid(extensions.st_makepoint(lon, lat), 4326)::extensions.geography
from (values
  ('Mandangad', 73.2583, 17.9888), ('Dapoli', 73.1887, 17.7580), ('Khed', 73.3960, 17.7184),
  ('Chiplun', 73.5123, 17.5330), ('Guhagar', 73.1911, 17.4838), ('Sangameshwar', 73.5355, 17.1716),
  ('Ratnagiri', 73.2954, 16.9934), ('Lanja', 73.5487, 16.8590), ('Rajapur', 73.5149, 16.6533),
  ('Bankot', 73.0487, 17.9795), ('Kelshi', 73.0632, 17.9211), ('Harnai', 73.0925, 17.8126),
  ('Murud (Dapoli)', 73.1180, 17.7740), ('Velneshwar', 73.2140, 17.3795), ('Ganpatipule', 73.2698, 17.1467),
  ('Bhatye', 73.2993, 16.9728), ('Purnagad', 73.3224, 16.8141), ('Ambolgad', 73.3285, 16.6425),
  ('Kumbharli ghat', 73.6800, 17.4100), ('Sakharpa (Amba ghat)', 73.7357, 17.0189)
) as p (name, lon, lat)
where not exists (select 1 from public.weather_points w where w.name = p.name);

-- ---------------------------------------------------------------- crons (G2: pg_cron + Edge Functions)
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Calls an Edge Function with the cron secret. Both values live in Vault (set per environment, never in git):
--   select vault.create_secret('<https://<ref>.supabase.co | http://kong:8000>', 'project_url');
--   select vault.create_secret('<random>', 'cron_secret');   -- same value as the CRON_SECRET function secret
create function app.invoke_edge(fn text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  base text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret');
begin
  if base is null or secret is null then
    raise warning 'invoke_edge(%): vault secrets project_url / cron_secret not set', fn;
    return null;
  end if;
  return net.http_post(
    url := base || '/functions/v1/' || fn,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;
revoke all on function app.invoke_edge(text) from public, anon, authenticated;

-- Coordinates for the cron functions (geography → lon/lat).
create function public.weather_point_coords() returns table (id uuid, name text, lon float8, lat float8)
language sql stable set search_path = '' as $$
  select id, name, extensions.st_x(location::extensions.geometry), extensions.st_y(location::extensions.geometry)
  from public.weather_points
$$;
create function public.tide_station_coords() returns table (id uuid, provider_station_id text, lon float8, lat float8)
language sql stable set search_path = '' as $$
  select id, provider_station_id, extensions.st_x(location::extensions.geometry), extensions.st_y(location::extensions.geometry)
  from public.tide_stations
$$;
revoke execute on function public.weather_point_coords, public.tide_station_coords from public, anon, authenticated;
grant execute on function public.weather_point_coords, public.tide_station_coords to service_role;

select cron.schedule('weather-refresh', '5 * * * *', $$select app.invoke_edge('weather-refresh')$$);
select cron.schedule('tide-refresh', '30 0 * * *', $$select app.invoke_edge('tide-refresh')$$); -- 06:00 IST

-- ---------------------------------------------------------------- map RPCs (BACKEND §14: /api/map/*)
-- Published listings in a bbox. open_now uses Asia/Kolkata time and weekday = extract(dow) (0 = Sunday);
-- unknown hours are never treated as open (FRONTEND §13). Stays have no opening hours and are unaffected.
create function public.map_pins(
  min_lon float8, min_lat float8, max_lon float8, max_lat float8,
  kinds text[] default null, categories public.place_category[] default null, open_now boolean default false
) returns table (
  kind text, id uuid, slug text, name_en text, name_hi text, name_mr text,
  category text, lon float8, lat float8, tide_station_id uuid
)
language sql stable security invoker set search_path = '' as $$
  with box as (select extensions.st_makeenvelope(min_lon, min_lat, max_lon, max_lat, 4326)::extensions.geography g),
  now_ist as (select (now() at time zone 'Asia/Kolkata') t),
  open_hours as (
    select h.weekday, h.opens, h.closes, h.hours_unknown, h.place_id as pid, null::uuid as eid from public.place_hours h
    union all
    select h.weekday, h.opens, h.closes, h.hours_unknown, null, h.eatery_id from public.eatery_hours h
  ),
  is_open as (
    select coalesce(pid, eid) as lid from open_hours, now_ist
    where not hours_unknown and opens is not null and closes is not null
      and weekday = extract(dow from t)::int
      and case when closes > opens then t::time >= opens and t::time < closes
               else t::time >= opens or t::time < closes end
  )
  select * from (
    select 'place', p.id, p.slug,
      (select name from public.place_translations x where x.place_id = p.id and x.lang = 'en'),
      (select name from public.place_translations x where x.place_id = p.id and x.lang = 'hi'),
      (select name from public.place_translations x where x.place_id = p.id and x.lang = 'mr'),
      p.category::text, extensions.st_x(p.location::extensions.geometry), extensions.st_y(p.location::extensions.geometry), p.tide_station_id
    from public.places p, box
    where p.status = 'published' and extensions.st_intersects(p.location, box.g)
      and (kinds is null or 'place' = any (kinds))
      and (categories is null or p.category = any (categories))
      and (not open_now or p.id in (select lid from is_open))
    union all
    select 'stay', s.id, s.slug,
      (select name from public.stay_translations x where x.stay_id = s.id and x.lang = 'en'),
      (select name from public.stay_translations x where x.stay_id = s.id and x.lang = 'hi'),
      (select name from public.stay_translations x where x.stay_id = s.id and x.lang = 'mr'),
      null, extensions.st_x(s.location::extensions.geometry), extensions.st_y(s.location::extensions.geometry), null
    from public.stays s, box
    where s.status = 'published' and extensions.st_intersects(s.location, box.g)
      and (kinds is null or 'stay' = any (kinds))
    union all
    select 'eatery', e.id, e.slug,
      (select name from public.eatery_translations x where x.eatery_id = e.id and x.lang = 'en'),
      (select name from public.eatery_translations x where x.eatery_id = e.id and x.lang = 'hi'),
      (select name from public.eatery_translations x where x.eatery_id = e.id and x.lang = 'mr'),
      null, extensions.st_x(e.location::extensions.geometry), extensions.st_y(e.location::extensions.geometry), null
    from public.eateries e, box
    where e.status = 'published' and extensions.st_intersects(e.location, box.g)
      and (kinds is null or 'eatery' = any (kinds))
      and (not open_now or e.id in (select lid from is_open))
  ) pins
  limit 2000;
$$;

create function public.map_utilities(
  min_lon float8, min_lat float8, max_lon float8, max_lat float8, types public.utility_type[]
) returns table (id uuid, type text, name text, phone text, lon float8, lat float8)
language sql stable security invoker set search_path = '' as $$
  select u.id, u.type::text, u.name, case when u.type = 'hospital' then u.phone end,
    extensions.st_x(u.location::extensions.geometry), extensions.st_y(u.location::extensions.geometry)
  from public.utility_pois u
  where u.type = any (types)
    and extensions.st_intersects(u.location, extensions.st_makeenvelope(min_lon, min_lat, max_lon, max_lat, 4326)::extensions.geography)
  limit 2000;
$$;

-- Own-DB search first (FRONTEND §8); the client falls back to Ola autocomplete only when this is empty.
create function public.map_search(q text)
returns table (kind text, slug text, name text, lang text, lon float8, lat float8)
language sql stable security invoker set search_path = '' as $$
  select * from (
    select 'place', p.slug, t.name, t.lang::text, extensions.st_x(p.location::extensions.geometry), extensions.st_y(p.location::extensions.geometry)
    from public.place_translations t join public.places p on p.id = t.place_id
    where p.status = 'published' and t.name ilike '%' || q || '%'
    union all
    select 'stay', s.slug, t.name, t.lang::text, extensions.st_x(s.location::extensions.geometry), extensions.st_y(s.location::extensions.geometry)
    from public.stay_translations t join public.stays s on s.id = t.stay_id
    where s.status = 'published' and t.name ilike '%' || q || '%'
    union all
    select 'eatery', e.slug, t.name, t.lang::text, extensions.st_x(e.location::extensions.geometry), extensions.st_y(e.location::extensions.geometry)
    from public.eatery_translations t join public.eateries e on e.id = t.eatery_id
    where e.status = 'published' and t.name ilike '%' || q || '%'
  ) r
  where length(q) >= 2
  limit 10;
$$;

grant execute on function public.map_pins, public.map_utilities, public.map_search to anon, authenticated;
