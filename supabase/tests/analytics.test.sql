-- T1-11: first-party analytics. Server-only writes and reads, nothing identifying, bounded size, 400-day purge.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.service() returns void language plpgsql as $$
begin
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
end;
$$;

select ok(not has_function_privilege('anon', 'public.log_analytics_event(text, jsonb, text, public.lang, text)', 'execute'), 'anon cannot log');
select ok(not has_function_privilege('authenticated', 'public.log_analytics_event(text, jsonb, text, public.lang, text)', 'execute'), 'users cannot log');
select ok(not has_function_privilege('authenticated', 'public.analytics_daily(integer)', 'execute'), 'users cannot read counts');
select ok(has_function_privilege('service_role', 'public.log_analytics_event(text, jsonb, text, public.lang, text)', 'execute'), 'the web server can log');
select hasnt_column('public', 'analytics_events', 'user_id', 'no user id column');

select pg_temp.service();
select lives_ok($$ select public.log_analytics_event('page_view', '{"n": 1}', repeat('a', 64), 'en', '/place/[slug]') $$, 'an event is stored');
select lives_ok($$ select public.log_analytics_event('qr_landing', null, null, 'mr', null) $$, 'props default to {}');
select throws_ok($$ select public.log_analytics_event('Page View', '{}', null, 'en', null) $$, '23514', null, 'names are snake_case');
select throws_ok($$ select public.log_analytics_event('x', '{}', null, 'en', null) $$, '23514', null, 'names are at least 2 letters');
select throws_ok($$ select public.log_analytics_event('search', '{}', '203.0.113.7', 'en', null) $$, '23514', null, 'a raw IP is not a session hash');
select throws_ok($$ select public.log_analytics_event('search', jsonb_build_object('q', repeat('x', 2000)), null, 'en', null) $$, '23514', null, 'props stay small');
select throws_ok($$ select public.log_analytics_event('search', '{}', null, 'en', repeat('/', 121)) $$, '23514', null, 'route is short');
select is((select n::int from public.analytics_daily(30) where name = 'page_view'), 1, 'daily counts per name');
select is((select props from public.analytics_events where name = 'qr_landing'), '{}'::jsonb, 'empty props');
reset role;

insert into auth.users (id, email) values ('00000000-0000-0000-0119-0000000000a1', 'an-user@test.local');
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0119-0000000000a1', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.analytics_events), 0, 'users read no events');
reset role;
select ok(exists (select 1 from cron.job where jobname = 'analytics-purge'), 'raw events are purged after 400 days');

select * from finish();
rollback;
