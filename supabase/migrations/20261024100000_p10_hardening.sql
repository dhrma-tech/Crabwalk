-- P10 hardening: close default PUBLIC execute on signed-in-only functions; per-client rate limits.

-- Postgres grants EXECUTE to PUBLIC by default; these are for signed-in users only (they also check inside).
revoke execute on function public.ai_take_message() from public, anon;
revoke execute on function public.create_qr_code(public.qr_entity_type, uuid) from public, anon;
revoke execute on function public.get_route_for_review(uuid) from public, anon;
revoke execute on function public.qr_verify_visit(text, float8, float8) from public, anon;
revoke execute on function public.review_booking_proof from public, anon;
revoke execute on function public.review_owner_claim from public, anon;

-- ---------------------------------------------------------------- rate limits (P4-3 deferral, BACKEND §14)
-- Fixed-window counters keyed by an HMAC of (client IP, route) computed in the web server; no IPs stored.
create table public.rate_hits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 1,
  primary key (key, window_start)
);
alter table public.rate_hits enable row level security; -- no policies: only rate_take() touches it

-- Returns true when the call is allowed. Old windows are pruned opportunistically.
create function public.rate_take(_key text, _limit integer, _window_s integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / _window_s) * _window_s);
  n integer;
begin
  if _key !~ '^[0-9a-f]{64}$' or _limit < 1 or _window_s < 1 or _window_s > 86400 then
    raise exception 'bad rate key' using errcode = '22023';
  end if;
  insert into public.rate_hits (key, window_start) values (_key, w)
  on conflict (key, window_start) do update set hits = public.rate_hits.hits + 1
  returning hits into n;
  if random() < 0.01 then
    delete from public.rate_hits where window_start < now() - interval '1 day';
  end if;
  return n <= _limit;
end;
$$;
