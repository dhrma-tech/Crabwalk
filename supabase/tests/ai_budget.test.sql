-- SEC-11: global AI budget, kill switch, fixed feature list for ai_take.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.login(_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', _uid, 'role', 'authenticated')::text, true);
end;
$$;
create function pg_temp.root() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

insert into auth.users (id, email) values ('00000000-0000-0000-0115-0000000000a1', 'aib@test.local');

-- ------------------------------------------------ grants
select ok(not has_function_privilege('anon', 'public.ai_budget_take(integer)', 'execute'), 'anon cannot take budget');
select ok(not has_function_privilege('authenticated', 'public.ai_budget_take(integer)', 'execute'), 'users cannot take budget');
select ok(has_function_privilege('service_role', 'public.ai_budget_take(integer)', 'execute'), 'the web server can');
select is((select value #>> '{}' from public.app_config where key = 'ai_enabled'), 'true', 'AI is on by default');
select is((select (value #>> '{}')::int from public.app_config where key = 'ai_global_daily_calls'), 3000, 'default budget is 3000 calls a day');

-- ------------------------------------------------ budget
delete from public.ai_budget;
update public.app_config set value = '3' where key = 'ai_global_daily_calls';
select is(public.ai_budget_take(), true, '1st call allowed');
select is(public.ai_budget_take(2), true, 'calls 2 and 3 allowed');
select is(public.ai_budget_take(), false, '4th call over the budget refused');
select is((select calls from public.ai_budget), 3, 'a refused call is not counted');
select is((select day from public.ai_budget), (now() at time zone 'Asia/Kolkata')::date, 'the day is the IST day');
select throws_ok($$ select public.ai_budget_take(0) $$, '22023', null, 'count must be positive');

-- ------------------------------------------------ kill switch
update public.app_config set value = '3000' where key = 'ai_global_daily_calls';
select is(public.ai_budget_take(), true, 'budget raised: allowed again');
update public.app_config set value = 'false' where key = 'ai_enabled';
select is(public.ai_budget_take(), false, 'ai_enabled = false stops every call');
delete from public.app_config where key = 'ai_enabled';
select is(public.ai_budget_take(), false, 'a missing switch means off');
select is((select calls from public.ai_budget), 4, 'nothing counted while off');

-- ------------------------------------------------ clients
select pg_temp.login('00000000-0000-0000-0115-0000000000a1');
select throws_ok($$ select public.ai_budget_take() $$, '42501', null, 'a user JWT cannot call it');
select is((select count(*)::int from public.ai_budget), 0, 'the table is not readable by clients');
select throws_ok($$ select public.ai_take('anything-else') $$, '22023', null, 'ai_take refuses unknown features');
select throws_ok($$ select public.ai_take(null) $$, '22023', null, 'and null');
select is((select count(*)::int from public.ai_feature_usage where user_id = '00000000-0000-0000-0115-0000000000a1'), 0,
  'no usage row for a refused feature');
select is(public.ai_take('snap'), 4, 'known features still work');

select * from finish();
rollback;
