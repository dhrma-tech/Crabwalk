-- T2-05: AI cache and turn log. Server-only, no text in turn rows, bounded values, hourly purge.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.service() returns void language plpgsql as $$
begin
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
end;
$$;

select ok(not has_function_privilege('anon', 'public.ai_cache_get(text)', 'execute'), 'anon cannot read the cache');
select ok(not has_function_privilege('authenticated', 'public.ai_cache_put(text, jsonb, integer)', 'execute'), 'users cannot write the cache');
select ok(not has_function_privilege('authenticated', 'public.ai_turn_log(public.lang, text, text[], smallint, integer, smallint, boolean)', 'execute'), 'users cannot log turns');
select ok(not has_function_privilege('authenticated', 'public.ai_turn_thumbs(bigint, smallint)', 'execute'), 'users cannot set thumbs directly');
select is(
  (select array_agg(column_name::text order by column_name) from information_schema.columns
   where table_schema = 'public' and table_name = 'ai_turns'),
  array['cached', 'day', 'id', 'lang', 'latency_ms', 'outcome', 'rounds', 'thumbs', 'tools', 'validator_retries'],
  'turn rows have no text, user or session column');

select pg_temp.service();
select lives_ok($$ select public.ai_cache_put(repeat('a', 64), '{"x": 1}', 600) $$, 'a value is cached');
select is(public.ai_cache_get(repeat('a', 64)), '{"x": 1}'::jsonb, 'and read back');
select lives_ok($$ select public.ai_cache_put(repeat('b', 64), '{"x": 2}', -5) $$, 'a bad ttl is clamped');
select throws_ok($$ select public.ai_cache_put('not-a-hash', '{}', 60) $$, '23514', null, 'keys are SHA-256 hex');
reset role;
update public.ai_cache set expires_at = now() - interval '1 second' where key = repeat('a', 64);
select pg_temp.service();
select is(public.ai_cache_get(repeat('a', 64)), null, 'expired rows are not returned');

select ok(public.ai_turn_log('en', 'answer', array['search_places', 'get_place'], 2::smallint, 830, 1::smallint, false) > 0, 'a turn is logged');
select throws_ok($$ select public.ai_turn_log('en', 'Show me forts', null, 0::smallint, 1, 0::smallint, false) $$, '23514', null, 'outcome is a fixed word, not text');
select throws_ok($$ select public.ai_turn_log('en', 'answer', array['where is the fort?'], 0::smallint, 1, 0::smallint, false) $$, '23514', null, 'tools are tool names, not text');
select ok(public.ai_turn_thumbs((select max(id) from public.ai_turns), -1::smallint), 'thumbs on a recent turn');
select ok(not public.ai_turn_thumbs(-1, 1::smallint), 'no such turn');
select throws_ok($$ select public.ai_turn_thumbs((select max(id) from public.ai_turns), 2::smallint) $$, '23514', null, 'thumbs are -1 or 1');
reset role;

select ok(exists (select 1 from cron.job where jobname = 'ai-cache-purge'), 'expired cache rows are purged hourly');
select * from finish();
rollback;
