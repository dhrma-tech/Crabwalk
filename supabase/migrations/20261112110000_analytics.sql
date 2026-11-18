-- Hardening 2026-11, T1-11 (UX-05): first-party analytics. Event rows only: no user id, IP, email or free text.
-- session_hash = HMAC(RATE_LIMIT_SALT, client key + IST date), computed by the web server; it changes every day.
create table public.analytics_events (
  id bigint generated always as identity primary key,
  day date not null default (now() at time zone 'Asia/Kolkata')::date,
  at timestamptz not null default now(),
  name text not null check (name ~ '^[a-z_]{2,40}$'),
  props jsonb not null default '{}' check (pg_column_size(props) <= 1024),
  session_hash text check (session_hash ~ '^[0-9a-f]{64}$'),
  lang public.lang,
  route text check (char_length(route) <= 120)
);
create index on public.analytics_events (day, name);
-- No policies: written and read by the web server's service client only.
alter table public.analytics_events enable row level security;

create function public.log_analytics_event(
  _name text, _props jsonb, _session_hash text, _lang public.lang, _route text
)
returns void
language sql security definer set search_path = '' as $$
  insert into public.analytics_events (name, props, session_hash, lang, route)
  values (_name, coalesce(_props, '{}'), _session_hash, _lang, _route);
$$;
revoke all on function public.log_analytics_event(text, jsonb, text, public.lang, text) from public, anon, authenticated;
grant execute on function public.log_analytics_event(text, jsonb, text, public.lang, text) to service_role;

-- /admin/insights: events per IST day and name over the last `_days` days.
create function public.analytics_daily(_days integer default 30)
returns table (day date, name text, n bigint)
language sql stable security definer set search_path = '' as $$
  select e.day, e.name, count(*)
  from public.analytics_events e
  where e.day > (now() at time zone 'Asia/Kolkata')::date - _days
  group by e.day, e.name
  order by e.day, e.name;
$$;
revoke all on function public.analytics_daily(integer) from public, anon, authenticated;
grant execute on function public.analytics_daily(integer) to service_role;

-- Raw events are kept 400 days (nightly, 03:10 IST).
select cron.schedule('analytics-purge', '40 21 * * *',
  $$delete from public.analytics_events where at < now() - interval '400 days'$$);
