-- SEC-04 + SEC-06 (hardening 2026-11): "live crowd" must be hard to fake and the limiter must not be writable
-- with the public anon key. Scans, rate hits and dwell rows now arrive only through the web server (service role).

-- ---------------------------------------------------------------- scans
-- client_key = HMAC(RATE_LIMIT_SALT, 'qr-scan:' + client IP) from the web server; never an IP.
alter table public.qr_scans add column client_key text check (client_key ~ '^[0-9a-f]{64}$');

drop function public.qr_record_scan(text, text, public.lang, double precision, double precision);
create function public.qr_record_scan(
  _code text, _session_hash text, _lang public.lang default null,
  _lat float8 default null, _lng float8 default null, _client_key text default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if _session_hash is null or _session_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'bad session' using errcode = '22023';
  end if;
  if _client_key is not null and _client_key !~ '^[0-9a-f]{64}$' then
    raise exception 'bad client key' using errcode = '22023';
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
  insert into public.qr_scans (code, lang, session_hash, lat, lng, client_key)
  values (_code, _lang, _session_hash, _lat, _lng, _client_key);
end;
$$;
revoke execute on function public.qr_record_scan(text, text, public.lang, double precision, double precision, text)
  from public, anon, authenticated;
grant execute on function public.qr_record_scan(text, text, public.lang, double precision, double precision, text)
  to service_role;

-- ---------------------------------------------------------------- rate limiter
-- Still called inside add_trip_member_by_email (a definer function), which keeps working.
revoke execute on function public.rate_take(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_take(text, integer, integer) to service_role;

-- ---------------------------------------------------------------- heatmap: distinct networks, not distinct cookies
-- Scans count by client_key (one per network) when the server supplied one; rows from before this migration
-- fall back to the session hash. Five forged sessions from one network are one visitor.
create or replace function public.map_heatmap(min_lon float8, min_lat float8, max_lon float8, max_lat float8)
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
      select coalesce(q.client_key, q.session_hash) sid from public.qr_scans q join public.qr_codes c on c.code = q.code
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

-- ---------------------------------------------------------------- dwell: server-derived ids only
-- No direct inserts: a user could grant themselves the consent row and post any anon_id and times.
drop policy "insert with consent" on public.dwell_events;

-- One visit per (derived id, place, IST day).
create unique index dwell_events_once_per_day
  on public.dwell_events (anon_id, place_id, ((arrived_at at time zone 'Asia/Kolkata')::date));

create function public.record_dwell(_user uuid, _place uuid, _anon_id text, _arrived timestamptz, _left timestamptz)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.consents c
    where c.user_id = _user and c.type = 'dwell_time' and c.granted and c.revoked_at is null
  ) then
    raise exception 'no consent' using errcode = '42501';
  end if;
  if _arrived is null or _left is null or _arrived <= now() - interval '24 hours' or _arrived > now() + interval '5 minutes'
     or _left <= _arrived or _left - _arrived >= interval '10 hours' then
    raise exception 'bad times' using errcode = '22023';
  end if;
  insert into public.dwell_events (anon_id, place_id, arrived_at, left_at)
  values (_anon_id, _place, _arrived, _left)
  on conflict do nothing;
end;
$$;
revoke execute on function public.record_dwell(uuid, uuid, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.record_dwell(uuid, uuid, text, timestamptz, timestamptz) to service_role;
