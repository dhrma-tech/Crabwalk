-- Hardening 2026-11, SEC-11: one global daily budget for model calls, a kill switch, and a fixed list of
-- per-user AI features. Must be live before any provider key is set.

insert into public.app_config (key, value, notes) values
  ('ai_enabled', 'true', 'Kill switch: anything but true stops every model call from the web app (SEC-11)'),
  ('ai_global_daily_calls', '3000', 'Model calls allowed per day (IST) across all users (SEC-11)')
on conflict (key) do nothing;

-- One row per IST day. Written only by ai_budget_take (RLS on, no policies: clients see nothing).
create table public.ai_budget (
  day date primary key,
  calls integer not null default 0
);
alter table public.ai_budget enable row level security;

-- The web server calls this before every provider call. False = do not call the model: switch off, or the
-- day's budget would be passed. Nothing is counted when it returns false.
create function public.ai_budget_take(_n integer default 1) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  enabled boolean := coalesce((select value #>> '{}' from public.app_config where key = 'ai_enabled'), '') = 'true';
  cap integer := coalesce((select (value #>> '{}')::integer from public.app_config where key = 'ai_global_daily_calls'), 0);
  today date := (now() at time zone 'Asia/Kolkata')::date;
  taken boolean;
begin
  if _n is null or _n < 1 or _n > 100 then
    raise exception 'bad count' using errcode = '22023';
  end if;
  if not enabled then
    return false;
  end if;
  insert into public.ai_budget (day) values (today) on conflict do nothing;
  update public.ai_budget set calls = calls + _n where day = today and calls + _n <= cap returning true into taken;
  return coalesce(taken, false);
end;
$$;
revoke all on function public.ai_budget_take(integer) from public, anon, authenticated;
grant execute on function public.ai_budget_take(integer) to service_role;

-- ai_take: only the features the app has (was: any text created a usage row). Body otherwise as in
-- 20261104100000_p12_crabby.sql.
create or replace function public.ai_take(_feature text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  cap integer;
  today date := (now() at time zone 'Asia/Kolkata')::date;
  used integer;
begin
  if auth.uid() is null then
    raise exception 'sign in' using errcode = '42501';
  end if;
  if _feature is null or _feature not in ('snap', 'reel', 'journal', 'report', 'host', 'profile') then
    raise exception 'bad feature' using errcode = '22023';
  end if;
  cap := coalesce((select value::integer from public.app_config where key = 'ai_cap_' || _feature), 5);
  insert into public.ai_feature_usage (user_id, date, feature) values (auth.uid(), today, _feature)
  on conflict do nothing;
  update public.ai_feature_usage set count = count + 1
  where user_id = auth.uid() and date = today and feature = _feature and count < cap
  returning count into used;
  if used is null then
    raise exception 'daily cap reached' using errcode = 'CW429';
  end if;
  return cap - used;
end;
$$;
