-- Hardening 2026-11, SEC-03: ratings count only from real (non-anonymous) accounts; a visit is verified only by
-- the web server, with a GPS accuracy limit and a velocity rule.

-- ---------------------------------------------------------------- real accounts
create function app.is_real_user() returns boolean
language sql stable set search_path = '' as $$
  select auth.uid() is not null and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) is false;
$$;

-- Guest votes are stored but not counted (owner decision, IMPLEMENTATION_LOG D-02).
alter table public.verdicts add column counted boolean not null default true;
alter table public.sub_scores add column counted boolean not null default true;

-- Clients cannot choose `counted`: with a user JWT it always follows the account type. Server writes
-- (auth.uid() null: seeds, service role, app.recount_user) keep the value they send.
create function app.set_counted() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null then
    new.counted := app.is_real_user();
  end if;
  return new;
end;
$$;
create trigger set_counted before insert or update on public.verdicts
  for each row execute function app.set_counted();
create trigger set_counted before insert or update on public.sub_scores
  for each row execute function app.set_counted();

-- ---------------------------------------------------------------- aggregates count only `counted` rows
-- Same body as 20261019100000_p5_ratings.sql plus `and counted`.
create or replace function app.refresh_verdict_agg(_type public.entity_type, _id uuid, _group public.group_type) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c integer[] := array[0, 0, 0, 0];
  t integer;
  best integer;
  win smallint;
  r record;
begin
  for r in select level, count(*)::int n from public.verdicts
           where entity_type = _type and entity_id = _id and group_type = _group and counted group by level loop
    c[r.level] := r.n;
  end loop;
  t := c[1] + c[2] + c[3] + c[4];
  if t = 0 then
    delete from public.verdict_agg where entity_type = _type and entity_id = _id and group_type = _group;
    return;
  end if;
  best := greatest(c[1], c[2], c[3], c[4]);
  win := case when c[4] = best then 4 when c[3] = best then 3 when c[2] = best then 2 else 1 end;
  insert into public.verdict_agg (entity_type, entity_id, group_type, counts, total, winner_level, winner_pct, is_new, updated_at)
  values (_type, _id, _group, c, t, win, round(best::numeric / t, 4), t < 10, now())
  on conflict (entity_type, entity_id, group_type) do update
    set counts = excluded.counts, total = excluded.total, winner_level = excluded.winner_level,
        winner_pct = excluded.winner_pct, is_new = excluded.is_new, updated_at = now();
end;
$$;

create or replace function public.sub_score_summary(_type public.entity_type, _id uuid)
returns table (dimension text, avg_score numeric, n integer)
language sql stable security definer set search_path = '' as $$
  select dimension::text, round(avg(score)::numeric, 1), count(*)::int
  from public.sub_scores where entity_type = _type and entity_id = _id and counted group by dimension;
$$;
-- public.verdict_agg_all sums verdict_agg, so it needs no change.

-- Backfill. The verdict_agg_refresh trigger re-counts each listing whose rows change.
update public.verdicts v set counted = false
from auth.users u where u.id = v.user_id and coalesce(u.is_anonymous, false) and v.counted;
update public.sub_scores s set counted = false
from auth.users u where u.id = s.user_id and coalesce(u.is_anonymous, false) and s.counted;

-- A guest who becomes a real account (identity linking, full-auth mode): the sign-in flow calls this once.
create function app.recount_user(_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  real boolean := not coalesce((select is_anonymous from auth.users where id = _user), true);
begin
  update public.verdicts set counted = real where user_id = _user and counted is distinct from real;
  update public.sub_scores set counted = real where user_id = _user and counted is distinct from real;
end;
$$;
revoke all on function app.recount_user(uuid) from public, anon, authenticated;
grant execute on function app.recount_user(uuid) to service_role;

-- ---------------------------------------------------------------- verified visit: server only
alter table public.verified_visits
  add column accuracy_m integer,
  add column client_key text check (client_key ~ '^[0-9a-f]{64}$');

drop function public.qr_verify_visit(text, float8, float8);
-- Called by POST /q/:code/visit with the service role, after it checked the signed scan cookie. `_user` is the
-- signed-in visitor. Not verified (and nothing stored) when: farther than qr_visit_radius_m, GPS accuracy unknown
-- or worse than 100 m, or the same user was verified in the last 30 minutes at a listing more than 50 km away.
create function public.qr_verify_visit(
  _user uuid, _code text, _lat float8, _lng float8, _accuracy integer, _client_key text
)
returns table (verified boolean, distance_m integer)
language plpgsql security definer set search_path = '' as $$
declare
  q public.qr_codes;
  here extensions.geography;
  d integer;
  r integer := (select value::integer from public.app_config where key = 'qr_visit_radius_m');
begin
  if _user is null then
    raise exception 'sign in' using errcode = '42501';
  end if;
  if _lat is null or _lng is null or _lat not between -90 and 90 or _lng not between -180 and 180 then
    raise exception 'bad position' using errcode = '22023';
  end if;
  if _client_key is not null and _client_key !~ '^[0-9a-f]{64}$' then
    raise exception 'bad client key' using errcode = '22023';
  end if;
  select * into q from public.qr_codes where code = _code;
  if not found or q.entity_type not in ('place', 'stay', 'eatery') then
    raise exception 'no listing for code' using errcode = 'P0002';
  end if;
  here := app.qr_entity_location(q.entity_type, q.entity_id);
  d := round(extensions.st_distance(
    here, extensions.st_setsrid(extensions.st_makepoint(_lng, _lat), 4326)::extensions.geography));
  if d is null then
    raise exception 'no listing for code' using errcode = 'P0002';
  end if;
  if d > r or _accuracy is null or _accuracy > 100 or exists (
    select 1 from public.verified_visits v
    where v.user_id = _user and v.method = 'qr_gps' and v.created_at > now() - interval '30 minutes'
      and extensions.st_distance(
        app.qr_entity_location(v.entity_type::text::public.qr_entity_type, v.entity_id), here) > 50000
  ) then
    return query select false, d;
    return;
  end if;
  if not exists (
    select 1 from public.verified_visits v
    where v.user_id = _user and v.entity_type = q.entity_type::text::public.entity_type
      and v.entity_id = q.entity_id and v.method = 'qr_gps' and v.created_at > now() - interval '1 day'
  ) then
    insert into public.verified_visits (user_id, entity_type, entity_id, method, distance_m, accuracy_m, client_key)
    values (_user, q.entity_type::text::public.entity_type, q.entity_id, 'qr_gps', d, _accuracy, _client_key);
  end if;
  return query select true, d;
end;
$$;
revoke all on function public.qr_verify_visit(uuid, text, float8, float8, integer, text) from public, anon, authenticated;
grant execute on function public.qr_verify_visit(uuid, text, float8, float8, integer, text) to service_role;
