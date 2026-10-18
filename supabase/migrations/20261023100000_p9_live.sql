-- P9: navigation turn cues, live trip + push, heatmap, alerts confirm/expiry, trails, dwell + pattern analysis.

-- ---------------------------------------------------------------- navigation (DECISIONS P9-2)
-- Compact OSRM maneuvers on the stored (simplified) shape: "vertexIndex+code" comma list, e.g. "14L,52SR,80O2".
alter table public.travel_matrix add column route_turns text;

-- One leg's stored route (shape + turn cues) between two DB entities, if the matrix has it.
create function public.nav_leg(_from uuid, _to uuid)
returns table (shape text, turns text, distance_m integer, duration_s integer)
language sql stable security invoker set search_path = '' as $$
  select tm.route_shape, tm.route_turns, tm.distance_m, tm.duration_corrected_s
  from public.travel_matrix tm
  join public.matrix_points a on a.id = tm.from_point_id and a.entity_id = _from
  join public.matrix_points b on b.id = tm.to_point_id and b.entity_id = _to;
$$;

-- ---------------------------------------------------------------- live trip + push (DECISIONS P9-3)
alter table public.trips add column live_date date;           -- trip is in live mode on this IST date
alter table public.trip_stops add column nudged_at timestamptz; -- max one push per stop

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
alter table public.push_subscriptions enable row level security;
-- Subscribing requires an active push consent.
create policy "own read" on public.push_subscriptions for select using (user_id = auth.uid());
create policy "own subscribe with consent" on public.push_subscriptions for insert
  with check (user_id = auth.uid() and exists (
    select 1 from public.consents c
    where c.user_id = auth.uid() and c.type = 'push' and c.granted and c.revoked_at is null));
create policy "own delete" on public.push_subscriptions for delete using (user_id = auth.uid());

-- Revoking a consent removes what it allowed (push subscriptions; dwell rows carry no user id).
create function app.on_consent_revoke() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.type = 'push' and (not new.granted or new.revoked_at is not null) then
    delete from public.push_subscriptions where user_id = new.user_id;
  end if;
  return new;
end;
$$;
create trigger on_consent_revoke after insert or update on public.consents
  for each row execute function app.on_consent_revoke();

-- ---------------------------------------------------------------- "Busy now" heatmap (G10, FRONTEND §8)
-- Every point carries its source: 'live' only with ≥ live_crowd_min_users distinct sessions (QR scans +
-- consented dwell arrivals) in the window; otherwise 'typical' from crowd_typical for today (IST).
create function public.map_heatmap(min_lon float8, min_lat float8, max_lon float8, max_lat float8)
returns table (slug text, lon float8, lat float8, weight real, source text)
language sql stable security definer set search_path = '' as $$
  with cfg as (
    select coalesce((select value::int from public.app_config where key = 'live_crowd_min_users'), 5) min_users,
           coalesce((select value::int from public.app_config where key = 'live_crowd_window_min'), 60) win
  ),
  box as (select extensions.st_makeenvelope(min_lon, min_lat, max_lon, max_lat, 4326)::extensions.geography g),
  p as (
    select pl.id, pl.slug, pl.location from public.places pl, box
    where pl.status = 'published' and extensions.st_intersects(pl.location, box.g)
  ),
  live as (
    select p.id, count(distinct s.sid) n
    from p, cfg,
    lateral (
      select q.session_hash sid from public.qr_scans q join public.qr_codes c on c.code = q.code
      where c.entity_type = 'place' and c.entity_id = p.id and q.scanned_at > now() - make_interval(mins => cfg.win)
      union
      select d.anon_id from public.dwell_events d
      where d.place_id = p.id and d.arrived_at > now() - make_interval(mins => cfg.win)
    ) s
    group by p.id
  ),
  typical as (
    select c.place_id id, max(case c.level when 'busy' then 1.0 when 'calm' then 0.5 else 0.15 end)::real w
    from public.crowd_typical c
    where c.weekday = extract(dow from now() at time zone 'Asia/Kolkata')
    group by c.place_id
  )
  select p.slug, extensions.st_x(p.location::extensions.geometry), extensions.st_y(p.location::extensions.geometry),
         case when l.n >= cfg.min_users then least(1.0, l.n / (cfg.min_users * 3.0))::real else t.w end,
         case when l.n >= cfg.min_users then 'live' else 'typical' end
  from p cross join cfg
  left join live l on l.id = p.id
  left join typical t on t.id = p.id
  where (l.n >= cfg.min_users) or t.w is not null;
$$;

-- ---------------------------------------------------------------- alerts (G9)
-- Active alerts in a box; expiry and "reported … ago" come from the row.
create function public.map_alerts(min_lon float8, min_lat float8, max_lon float8, max_lat float8)
returns table (id uuid, type text, severity text, reason_en text, reason_hi text, reason_mr text,
               reported_at timestamptz, expires_at timestamptz, geojson text)
language sql stable security invoker set search_path = '' as $$
  select a.id, a.type::text, a.severity, a.reason_en, a.reason_hi, a.reason_mr, a.reported_at, a.expires_at,
         extensions.st_asgeojson(a.geometry)
  from public.alerts a
  where a.expires_at > now()
    and extensions.st_intersects(a.geometry, extensions.st_makeenvelope(min_lon, min_lat, max_lon, max_lat, 4326)::extensions.geography);
$$;

-- Re-confirming an alert extends it by its type TTL (G9: auto-expire unless re-confirmed).
create function public.confirm_alert(_id uuid) returns timestamptz
language plpgsql security invoker set search_path = '' as $$
declare e timestamptz;
begin
  update public.alerts a
     set confirmed_at = now(),
         expires_at = now() + make_interval(hours => coalesce((select t.ttl_hours from public.alert_type_ttl t where t.type = a.type), 24)),
         updated_at = now()
   where a.id = _id
  returning a.expires_at into e;
  if e is null then raise exception 'not allowed' using errcode = '42501'; end if;
  return e;
end;
$$;

-- ---------------------------------------------------------------- trails (DECISIONS P9-1)
alter table public.trails
  add column osm_id bigint unique,
  add constraint trails_difficulty_check check (difficulty in ('easy', 'moderate', 'hard'));
alter table public.trails drop constraint trails_source_check;
alter table public.trails add constraint trails_source_check check (source in ('osm', 'osm_verified', 'team_recorded'));
create index if not exists trails_geom on public.trails using gist (geometry);

create function public.map_trails(min_lon float8, min_lat float8, max_lon float8, max_lat float8)
returns table (id uuid, name_en text, name_hi text, name_mr text, source text, difficulty text, km numeric, geojson text)
language sql stable security invoker set search_path = '' as $$
  select t.id, t.name_en, t.name_hi, t.name_mr, t.source, t.difficulty,
         round((extensions.st_length(t.geometry) / 1000)::numeric, 1), extensions.st_asgeojson(t.geometry, 5)
  from public.trails t
  where t.geometry is not null
    and extensions.st_intersects(t.geometry, extensions.st_makeenvelope(min_lon, min_lat, max_lon, max_lat, 4326)::extensions.geography);
$$;

-- One trail's line for the GPX download.
create function public.trail_geojson(_id uuid)
returns table (name_en text, geojson text)
language sql stable security invoker set search_path = '' as $
  select t.name_en, extensions.st_asgeojson(t.geometry, 6) from public.trails t where t.id = _id and t.geometry is not null;
$;

-- ---------------------------------------------------------------- dwell + pattern analysis (BACKEND §10.6)
-- Consented dwell visits → median minutes per place (≥ 5 samples); the planner prefers a verifier value.
alter table public.places add column dwell_minutes smallint check (dwell_minutes between 5 and 600);
alter table public.dwell_events add constraint dwell_anon_id_check check (anon_id ~ '^[0-9a-f-]{36}$');

create function public.refresh_patterns() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.places p set dwell_minutes = s.med
  from (
    select place_id, round(percentile_cont(0.5) within group (order by extract(epoch from left_at - arrived_at) / 60))::smallint med
    from public.dwell_events
    where left_at is not null and left_at > arrived_at and left_at - arrived_at < interval '10 hours'
    group by place_id having count(*) >= 5
  ) s
  where s.place_id = p.id and s.med between 5 and 600;

  delete from public.route_stats;
  -- Trending: consecutive place pairs most often planned in saved/completed trips (last 60 days).
  insert into public.route_stats (kind, stops, score)
  select 'trending', array[a, b], count(*)
  from (
    select s.entity_id a, lead(s.entity_id) over (partition by s.trip_id, s.day order by s."order") b
    from public.trip_stops s join public.trips t on t.id = s.trip_id
    where s.kind = 'place' and t.status in ('saved', 'completed') and t.created_at > now() - interval '60 days'
  ) x
  where b is not null
  group by a, b having count(*) >= 3
  order by count(*) desc limit 10;
  -- Underrated: well-rated places (≥ 10 votes, winner ≥ "Worth it") rarely in trips.
  insert into public.route_stats (kind, stops, score)
  select 'underrated', array[v.entity_id], v.winner_level::numeric * 10 - count(s.id)
  from public.verdict_agg_all v
  join public.places p on p.id = v.entity_id and p.status = 'published'
  left join public.trip_stops s on s.entity_id = v.entity_id and s.kind = 'place'
  where v.entity_type = 'place' and v.total >= 10 and v.winner_level >= 3
  group by v.entity_id, v.winner_level
  order by 3 desc limit 10;
end;
$$;
revoke execute on function public.refresh_patterns from public, anon, authenticated;

-- ---------------------------------------------------------------- schedules
select cron.schedule('trip-nudges', '*/5 * * * *', $$select app.invoke_edge('trip-nudges')$$);
select cron.schedule('refresh-patterns', '30 20 * * *', $$select public.refresh_patterns()$$); -- 02:00 IST
