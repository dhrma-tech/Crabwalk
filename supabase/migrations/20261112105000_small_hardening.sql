-- Hardening 2026-11: small database fixes (SEC-17, SEC-13, SEC-07, SEC-19, SEC-25, SEC-27).

-- ---------------------------------------------------------------- SEC-17: shared trip, explicit fields
-- The share page and the reviewer's route view use these trip fields (lib/server/planner/trips.ts tripView);
-- the start point goes out as its label only, never coordinates. Stops are unchanged.
create or replace function public.get_shared_trip(_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'trip', jsonb_build_object('id', t.id, 'title', t.title, 'days', t.days, 'pace', t.pace,
      'start_date', t.start_date, 'status', t.status, 'group_type', t.group_type,
      'start_label', t.start_point ->> 'label'),
    'stops', coalesce((select jsonb_agg(to_jsonb(s) order by s.day, s."order")
                       from public.trip_stops s where s.trip_id = t.id), '[]'::jsonb)
  )
  from public.trips t
  where t.share_token = _token;
$$;

create or replace function public.get_route_for_review(_trip uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'trip', jsonb_build_object('id', t.id, 'title', t.title, 'days', t.days, 'pace', t.pace,
      'start_date', t.start_date, 'status', t.status, 'group_type', t.group_type,
      'start_label', t.start_point ->> 'label'),
    'stops', coalesce((select jsonb_agg(to_jsonb(s) order by s.day, s."order")
                       from public.trip_stops s where s.trip_id = t.id), '[]'::jsonb)
  )
  from public.trips t
  join public.published_routes r on r.trip_id = t.id
  where t.id = _trip and (app.has_role('reviewer') or app.is_admin());
$$;

-- ---------------------------------------------------------------- SEC-13: push endpoints from push services only
-- trip-nudges (Edge Function) fetches whatever endpoint is stored; only the browsers' push services are allowed.
alter table public.push_subscriptions add constraint push_endpoint_host check (
  endpoint ~ '^https://([a-z0-9-]+\.)*(fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)/'
  and char_length(endpoint) <= 1000
) not valid;
delete from public.push_subscriptions
where not (endpoint ~ '^https://([a-z0-9-]+\.)*(fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)/'
           and char_length(endpoint) <= 1000);
alter table public.push_subscriptions validate constraint push_endpoint_host;

-- At most 10 devices per user. Re-subscribing an endpoint already stored (upsert) is not a new device.
create function app.push_subscription_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.push_subscriptions where endpoint = new.endpoint)
     and (select count(*) from public.push_subscriptions where user_id = new.user_id) >= 10 then
    raise exception 'too many devices' using errcode = '54000';
  end if;
  return new;
end;
$$;
revoke all on function app.push_subscription_quota() from public, anon, authenticated;
create trigger push_subscription_quota before insert on public.push_subscriptions
  for each row execute function app.push_subscription_quota();

-- ---------------------------------------------------------------- SEC-07: email invites, no account oracle
-- Always true, so the answer never tells whether an address has an account; guests cannot invite by email.
-- Names never come from an email address: the profile name, else 'Tripmate' ('Me' for the owner's own row).
create or replace function public.add_trip_member_by_email(_trip uuid, _email text, _role public.trip_role)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid;
begin
  if app.trip_role(_trip) is distinct from 'owner' then
    raise exception 'only the owner invites by email' using errcode = '42501';
  end if;
  if not app.is_real_user() then
    raise exception 'sign in with an account to invite by email' using errcode = '42501';
  end if;
  if _role not in ('editor', 'viewer') then
    raise exception 'bad role' using errcode = '22023';
  end if;
  if not public.rate_take(encode(extensions.digest('trip-email:' || auth.uid()::text, 'sha256'), 'hex'), 30, 3600) then
    raise exception 'too many invites, try again later' using errcode = '54000';
  end if;
  select id into _uid from auth.users where lower(email) = lower(trim(_email));
  if _uid is null then
    return true;
  end if;
  insert into public.trip_members (trip_id, user_id, display_name, role)
  select _trip, _uid, left(coalesce(nullif(p.display_name, ''), 'Tripmate'), 60), _role
  from auth.users u left join public.profiles p on p.id = u.id
  where u.id = _uid
  on conflict (trip_id, user_id) do update set role = excluded.role
    where public.trip_members.role <> 'owner';
  return true;
end;
$$;

create or replace function public.redeem_trip_invite(_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  _inv public.trip_invites;
  _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'sign in to join a trip' using errcode = '42501';
  end if;
  select * into _inv from public.trip_invites where token = _token and revoked_at is null;
  if _inv.id is null then
    raise exception 'invalid invite' using errcode = '42501';
  end if;
  insert into public.trip_members (trip_id, user_id, display_name, role)
  select _inv.trip_id, _uid, left(coalesce(nullif(p.display_name, ''), 'Tripmate'), 60), _inv.role
  from auth.users u left join public.profiles p on p.id = u.id
  where u.id = _uid
  on conflict (trip_id, user_id) do update
    set role = case when public.trip_members.role = 'viewer' then excluded.role else public.trip_members.role end;
  return _inv.trip_id;
end;
$$;

create or replace function app.trip_owner_member() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.trip_members (trip_id, user_id, display_name, role)
  select new.id, new.owner_id, left(coalesce(nullif(p.display_name, ''), 'Me'), 60), 'owner'
  from auth.users u left join public.profiles p on p.id = u.id
  where u.id = new.owner_id
  on conflict (trip_id, user_id) do nothing;
  return null;
end;
$$;

-- Existing rows named after the email's local part (and nothing the person typed) get the same neutral name.
update public.trip_members m
set display_name = case when m.role = 'owner' then 'Me' else 'Tripmate' end
from auth.users u left join public.profiles p on p.id = u.id
where m.user_id = u.id and u.email is not null
  and nullif(p.display_name, '') is null
  and m.display_name = left(split_part(u.email, '@', 1), 60);

-- ---------------------------------------------------------------- SEC-19: QR codes, public columns only
-- Plaque permission notes and install dates are staff data (read with the service client after requireStaff).
revoke select on public.qr_codes from anon, authenticated;
grant select (id, code, entity_type, entity_id, sponsor_id, created_at) on public.qr_codes to anon, authenticated;

-- ---------------------------------------------------------------- SEC-25: map search, literal text only
-- `%` and `_` typed by a visitor are searched for as characters, not wildcards; more than 60 characters → nothing.
-- Body otherwise as in 20261026100000_discover_today_search.sql.
create or replace function public.map_search(q text)
returns table (kind text, slug text, name text, lang text, lon double precision, lat double precision)
language sql stable set search_path = '' as $$
  with s as (
    select '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%' as p
    where char_length(q) between 2 and 60
  )
  select r.kind, r.slug, r.name, r.lang, r.lon, r.lat from (
    select h.*, row_number() over (partition by h.kind order by h.name) as n from (
      select 'place' as kind, p.slug, t.name, t.lang::text as lang,
        extensions.st_x(p.location::extensions.geometry) as lon, extensions.st_y(p.location::extensions.geometry) as lat
      from public.place_translations t join public.places p on p.id = t.place_id
      where p.status = 'published' and t.name ilike (select s.p from s)
      union all
      select 'stay', s2.slug, t.name, t.lang::text,
        extensions.st_x(s2.location::extensions.geometry), extensions.st_y(s2.location::extensions.geometry)
      from public.stay_translations t join public.stays s2 on s2.id = t.stay_id
      where s2.status = 'published' and t.name ilike (select s.p from s)
      union all
      select 'eatery', e.slug, t.name, t.lang::text,
        extensions.st_x(e.location::extensions.geometry), extensions.st_y(e.location::extensions.geometry)
      from public.eatery_translations t join public.eateries e on e.id = t.eatery_id
      where e.status = 'published' and t.name ilike (select s.p from s)
      union all
      select 'dish', d.slug, t.name, t.lang::text, null, null
      from public.dish_translations t join public.dishes d on d.id = t.dish_id
      where t.name ilike (select s.p from s)
    ) h
  ) r
  where r.n <= 5
  order by array_position(array['place', 'stay', 'eatery', 'dish'], r.kind), r.n;
$$;

-- ---------------------------------------------------------------- SEC-27: booking links are https only
alter table public.stay_offers add constraint deep_link_https check (deep_link ~ '^https://') not valid;
-- Existing bad rows are reported, never deleted: the constraint stays NOT VALID until the team fixes them.
do $$
declare bad integer := (select count(*) from public.stay_offers where deep_link !~ '^https://');
begin
  if bad = 0 then
    alter table public.stay_offers validate constraint deep_link_https;
  else
    raise warning 'stay_offers: % row(s) with a non-https deep_link; constraint deep_link_https left NOT VALID', bad;
  end if;
end;
$$;
