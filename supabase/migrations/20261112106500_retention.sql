-- Hardening 2026-11, SEC-15: retention jobs.
-- 1. Guest (anonymous) accounts idle for 30 days are deleted with everything they own (rows cascade).
--    "Idle" = no sign-in, no account update and no session refresh in 30 days: a guest's last_sign_in_at does
--    not move while their session keeps refreshing, so it alone would delete people who use the app daily.
-- 2. QR scan positions are dropped after 24 hours (the live crowd needs only the last hour; heatmap counts stay).
-- 3. Rate-limiter windows older than a day are deleted.

create function app.purge_idle_guests(_limit integer default 5000) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select u.id from auth.users u
    where u.is_anonymous
      and greatest(u.created_at, u.last_sign_in_at, u.updated_at) < now() - interval '30 days'
      and not exists (
        select 1 from auth.sessions s
        where s.user_id = u.id
          and greatest(s.created_at, s.updated_at, s.refreshed_at::timestamptz) > now() - interval '30 days')
    limit _limit
  loop
    -- One guest that cannot be deleted (a row still points at it) never stops the rest.
    begin
      delete from auth.users where id = r.id;
      n := n + 1;
    exception when foreign_key_violation then
      raise warning 'guest % kept: still referenced', r.id;
    end;
  end loop;
  return n;
end;
$$;
revoke all on function app.purge_idle_guests(integer) from public, anon, authenticated;

create function app.purge_short_lived() returns void
language sql security definer set search_path = '' as $$
  update public.qr_scans set lat = null, lng = null
  where scanned_at < now() - interval '24 hours' and (lat is not null or lng is not null);
  delete from public.rate_hits where window_start < now() - interval '1 day';
$$;
revoke all on function app.purge_short_lived() from public, anon, authenticated;

select cron.schedule('retention-idle-guests', '0 21 * * *', $$select app.purge_idle_guests()$$);  -- 02:30 IST
select cron.schedule('retention-short-lived', '20 * * * *', $$select app.purge_short_lived()$$);   -- hourly
