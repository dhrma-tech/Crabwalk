-- Hardening 2026-11, T3-02 (F10): plaque health for /admin/qr. Per code: distinct visitors (client_key) in the
-- last 7 and 30 days, open "broken QR" reports, and a flag for an installed plaque with no scan in 30 days (a
-- plaque installed less than 30 days ago is not flagged yet). Read-only; service role only (the admin page calls
-- it after the admin check). Uses the (code, scanned_at) index.
create function public.qr_plaque_health()
returns table (code text, scans_7d integer, scans_30d integer, broken_open integer, silent boolean)
language sql stable security invoker set search_path = '' as $$
  select q.code, s.d7, s.d30,
    (select count(*)::int from public.reports r
     where r.qr_code = q.code and r.type = 'broken_qr' and r.status in ('new', 'triaged')),
    q.installed_at is not null and q.installed_at <= now() - interval '30 days' and s.d30 = 0
  from public.qr_codes q
  cross join lateral (
    select
      count(distinct x.client_key) filter (where x.scanned_at > now() - interval '7 days')::int as d7,
      count(distinct x.client_key)::int as d30
    from public.qr_scans x
    where x.code = q.code and x.scanned_at > now() - interval '30 days'
  ) s;
$$;
revoke execute on function public.qr_plaque_health from public, anon, authenticated;
grant execute on function public.qr_plaque_health to service_role;
