-- SEC-08: admin gate counter with a limit and lock time; the global key locks everyone after 50 failures.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select ok(not has_function_privilege('anon', 'public.gate_record(text, boolean, integer, integer)', 'execute'), 'anon cannot count');
select ok(not has_function_privilege('authenticated', 'public.gate_record(text, boolean, integer, integer)', 'execute'), 'users cannot count');
select ok(has_function_privilege('service_role', 'public.gate_record(text, boolean, integer, integer)', 'execute'), 'the web server can');

-- Global key: 49 failures do nothing, the 50th locks for about 15 minutes.
select is((select count(*)::int from generate_series(1, 49) where public.gate_record(repeat('0', 64), false, 50, 900) is not null), 0,
  '49 failures across all clients: not locked');
select isnt(public.gate_record(repeat('0', 64), false, 50, 900), null, '50th failure locks everyone');
select ok(public.gate_locked(repeat('0', 64)) between now() + interval '14 minutes' and now() + interval '16 minutes',
  'for 15 minutes');

-- Per-client defaults are unchanged: 10 failures, one hour.
select is((select count(*)::int from generate_series(1, 9) where public.gate_record('one-client', false) is not null), 0, '9 failures: not locked');
select ok(public.gate_record('one-client', false) between now() + interval '59 minutes' and now() + interval '61 minutes',
  '10th failure locks that client for an hour');

select throws_ok($$ select public.gate_record('k', false, 0, 900) $$, '22023', null, 'a zero limit is refused');
select throws_ok($$ select public.gate_record('k', false, 10, 10) $$, '22023', null, 'a lock shorter than a minute is refused');

select * from finish();
rollback;
