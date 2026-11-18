-- Hardening 2026-11, T2-05 (AI-09, AI-10): a short-lived cache for Crabby's public tool results and whole
-- answers, and one row per turn with no text (outcome, tools, timings, thumbs). Server-only: RLS on, no policies,
-- RPCs for service_role. The web server hands them to the AI code (lib/server/aiStore.ts); AI code never holds
-- the service key.
create table public.ai_cache (
  key text primary key check (key ~ '^[0-9a-f]{64}$'),
  value jsonb not null check (pg_column_size(value) <= 65536),
  expires_at timestamptz not null
);
create index on public.ai_cache (expires_at);
alter table public.ai_cache enable row level security;

create table public.ai_turns (
  id bigint generated always as identity primary key,
  day date not null default (now() at time zone 'Asia/Kolkata')::date,
  lang public.lang,
  outcome text not null check (outcome in ('answer', 'unknown', 'refused', 'off_topic', 'unavailable')),
  tools text[] not null default '{}' check (
    cardinality(tools) <= 24 and array_to_string(tools, ',') ~ '^([a-z_]{2,40}(,|$))*$'
  ),
  rounds smallint not null default 0 check (rounds between 0 and 10),
  latency_ms integer check (latency_ms >= 0),
  validator_retries smallint not null default 0 check (validator_retries between 0 and 5),
  cached boolean not null default false,
  thumbs smallint check (thumbs in (-1, 1))
);
create index on public.ai_turns (day);
alter table public.ai_turns enable row level security;

create function public.ai_cache_get(_key text)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select value from public.ai_cache where key = _key and expires_at > now();
$$;

create function public.ai_cache_put(_key text, _value jsonb, _ttl_s integer)
returns void
language sql security definer set search_path = '' as $$
  insert into public.ai_cache (key, value, expires_at)
  values (_key, _value, now() + make_interval(secs => least(greatest(_ttl_s, 1), 3600)))
  on conflict (key) do update set value = excluded.value, expires_at = excluded.expires_at;
$$;

create function public.ai_turn_log(
  _lang public.lang, _outcome text, _tools text[], _rounds smallint, _latency_ms integer,
  _validator_retries smallint, _cached boolean
)
returns bigint
language sql security definer set search_path = '' as $$
  insert into public.ai_turns (lang, outcome, tools, rounds, latency_ms, validator_retries, cached)
  values (_lang, _outcome, coalesce(_tools, '{}'), _rounds, _latency_ms, _validator_retries, _cached)
  returning id;
$$;

-- Thumbs on a turn from today or yesterday (IST); false when there is no such turn.
create function public.ai_turn_thumbs(_id bigint, _thumbs smallint)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.ai_turns set thumbs = _thumbs
  where id = _id and day >= (now() at time zone 'Asia/Kolkata')::date - 1;
  return found;
end;
$$;

revoke all on function public.ai_cache_get(text) from public, anon, authenticated;
revoke all on function public.ai_cache_put(text, jsonb, integer) from public, anon, authenticated;
revoke all on function public.ai_turn_log(public.lang, text, text[], smallint, integer, smallint, boolean)
  from public, anon, authenticated;
revoke all on function public.ai_turn_thumbs(bigint, smallint) from public, anon, authenticated;
grant execute on function public.ai_cache_get(text) to service_role;
grant execute on function public.ai_cache_put(text, jsonb, integer) to service_role;
grant execute on function public.ai_turn_log(public.lang, text, text[], smallint, integer, smallint, boolean)
  to service_role;
grant execute on function public.ai_turn_thumbs(bigint, smallint) to service_role;

-- Expired cache rows go every hour.
select cron.schedule('ai-cache-purge', '7 * * * *', $$delete from public.ai_cache where expires_at < now()$$);
