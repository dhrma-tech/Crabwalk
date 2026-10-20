-- P10 security audit as tests: every public table has RLS; anon can execute only the intended
-- security-definer functions; rate limiter refuses past the limit and rejects raw (non-HMAC) keys.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select is(
  (select coalesce(string_agg(tablename, ', '), '') from pg_tables where schemaname = 'public' and not rowsecurity),
  '', 'every public table has row-level security');

-- Security-definer functions anon may call (guest/QR/heatmap flows). Anything else is a leak.
select is(
  (select coalesce(string_agg(p.proname, ', ' order by p.proname), '')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
     and has_function_privilege('anon', p.oid, 'execute')
     and p.proname not in ('cast_group_vote', 'get_shared_trip', 'map_heatmap', 'qr_record_scan',
                           'sub_score_summary', 'trip_vote_counts', 'rate_take')),
  '', 'anon can execute only the allowlisted security-definer functions');

select ok(not has_function_privilege('anon', 'public.ai_take_message()', 'execute'), 'anon cannot use the AI cap');
select ok(not has_function_privilege('anon', 'public.qr_verify_visit(text, float8, float8)', 'execute'), 'anon cannot verify visits');
select ok(not has_function_privilege('authenticated', 'public.refresh_patterns()', 'execute'), 'users cannot run the pattern job');

-- Rate limiter.
set local role anon;
select is(public.rate_take(repeat('a', 64), 2, 600), true, '1st call allowed');
select is(public.rate_take(repeat('a', 64), 2, 600), true, '2nd call allowed');
select is(public.rate_take(repeat('a', 64), 2, 600), false, '3rd call over the limit refused');
select is(public.rate_take(repeat('b', 64), 2, 600), true, 'other clients unaffected');
select throws_ok($$ select public.rate_take('203.0.113.7', 2, 600) $$, '22023', null, 'raw IPs are rejected as keys');
select is((select count(*)::int from public.rate_hits), 0, 'clients cannot read counters');

select * from finish();
rollback;
