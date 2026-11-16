-- Hardening 2026-11, SEC-08: the admin gate counter takes its limit and lock time, so one more key can count
-- failures from ALL clients (50 in an hour → everyone locked out for 15 minutes) next to the per-client key
-- (10 in an hour → that client locked out for an hour, unchanged). Body as in
-- 20261107100000_team_table_atomic_save.sql with the two numbers as parameters.
drop function public.gate_record(text, boolean);

create function public.gate_record(_key text, _ok boolean, _max integer default 10, _lock_s integer default 3600)
returns timestamptz
language plpgsql security invoker set search_path = '' as $$
declare r public.gate_attempts;
begin
  if _max is null or _max not between 1 and 1000 or _lock_s is null or _lock_s not between 60 and 86400 then
    raise exception 'bad limit' using errcode = '22023';
  end if;
  if _ok then
    delete from public.gate_attempts where key = _key;
    return null;
  end if;
  insert into public.gate_attempts as g (key, fails, first_fail_at) values (_key, 1, now())
  on conflict (key) do update set
    fails = case when g.first_fail_at < now() - interval '1 hour' and coalesce(g.locked_until, '-infinity') < now()
                 then 1 else g.fails + 1 end,
    first_fail_at = case when g.first_fail_at < now() - interval '1 hour' and coalesce(g.locked_until, '-infinity') < now()
                 then now() else g.first_fail_at end
  returning * into r;
  if r.fails >= _max and coalesce(r.locked_until, '-infinity') < now() then
    update public.gate_attempts set locked_until = now() + make_interval(secs => _lock_s) where key = _key
      returning * into r;
  end if;
  return case when r.locked_until > now() then r.locked_until end;
end;
$$;
revoke all on function public.gate_record(text, boolean, integer, integer) from public, anon, authenticated;
grant execute on function public.gate_record(text, boolean, integer, integer) to service_role;
