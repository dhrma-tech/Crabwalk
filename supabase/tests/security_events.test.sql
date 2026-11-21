-- SEC-16: security events (server only, no IPs) and one admin audit row per editor save (keys only, hashed actor).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
-- Start from an empty table: e2e runs leave rows behind (rolled back at the end).
delete from public.security_events;

create function pg_temp.service() returns void language plpgsql as $$
begin
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
end;
$$;
create function pg_temp.login(_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', _uid, 'role', 'authenticated')::text, true);
end;
$$;

-- ------------------------------------------------ security events
select ok(not has_function_privilege('anon', 'public.log_security_event(text, text, jsonb)', 'execute'), 'anon cannot log');
select ok(not has_function_privilege('authenticated', 'public.log_security_event(text, text, jsonb)', 'execute'), 'users cannot log');
select ok(has_function_privilege('service_role', 'public.log_security_event(text, text, jsonb)', 'execute'), 'the web server can');
select pg_temp.service();
select lives_ok($$ select public.log_security_event('admin_gate_fail', repeat('c', 64), '{"email_sha256": "ab"}') $$, 'an event is stored');
select throws_ok($$ select public.log_security_event('limiter_deny', '203.0.113.7', null) $$, '23514', null, 'a raw IP is not a client key');
select throws_ok($$ select public.log_security_event(repeat('k', 61), null, null) $$, '23514', null, 'kind is short');
select throws_ok($$ select public.log_security_event('x', null, jsonb_build_object('blob', repeat('x', 5000))) $$, '23514', null,
  'detail is small');
select is((select count(*)::int from public.security_events where kind = 'admin_gate_fail'), 1, 'one row');
reset role;
select ok(exists (select 1 from cron.job where jobname = 'security-events-purge'), 'events are purged after 90 days');
insert into auth.users (id, email) values ('00000000-0000-0000-0118-0000000000a1', 'se-user@test.local');
select pg_temp.login('00000000-0000-0000-0118-0000000000a1');
select is((select count(*)::int from public.security_events), 0, 'users read no events');
select is((select count(*)::int from public.admin_audit), 0, 'users read no audit rows');
reset role;

-- ------------------------------------------------ admin audit
insert into public.places (id, slug, category, taluka_id, location, status)
values ('00000000-0000-0000-0118-0000000000f1', 'se-fixture', 'beach',
        (select id from public.talukas order by name_en limit 1), 'SRID=4326;POINT(73.3 16.99)', 'draft');
create temp table v as select updated_at from public.places where id = '00000000-0000-0000-0118-0000000000f1';
grant select on v to service_role;
select pg_temp.service();
select lives_ok(
  $$select public.admin_apply_save('place', '00000000-0000-0000-0118-0000000000f1', (select updated_at from v), '{
      "row": {"best_time_text": "Mornings", "status": "in_review"},
      "team": {"verified_by": "Editor@Example.org", "reviewed_by": null, "last_edited_by": "Editor@Example.org"},
      "tr": [{"lang": "en", "values": {"name": "SE place"}}, {"lang": "mr", "values": {"name": "एसई"}}],
      "form": {"village_or_area": "Mirya"},
      "private": {"owner_phone": "9876512345", "internal_notes": "secret note", "source_notes": null}
    }')$$, 'an editor save');
select is((select count(*)::int from public.admin_audit where entity_id = '00000000-0000-0000-0118-0000000000f1'), 1,
  'one audit row per save');
select is((select action from public.admin_audit where entity_id = '00000000-0000-0000-0118-0000000000f1'), 'status:in_review',
  'a status change is named');
select is((select diff from public.admin_audit where entity_id = '00000000-0000-0000-0118-0000000000f1'),
  '{"tr": ["en", "mr"], "row": ["best_time_text", "status"], "form": ["village_or_area"], "private": true}'::jsonb,
  'which parts changed, keys only');
select is((select actor from public.admin_audit where entity_id = '00000000-0000-0000-0118-0000000000f1'),
  encode(extensions.digest('editor@example.org', 'sha256'), 'hex'), 'the editor as a SHA-256 of the email');
select ok((select row_to_json(a)::text from public.admin_audit a where entity_id = '00000000-0000-0000-0118-0000000000f1')
  !~* 'example\.org|9876512345|secret note|Mornings', 'no email, phone, note or value in the row');

-- A save that fails (stale version) leaves no audit row.
select throws_ok(
  $$select public.admin_apply_save('place', '00000000-0000-0000-0118-0000000000f1', (select updated_at from v),
    '{"row": {"best_time_text": "Late"}, "team": {"last_edited_by": "editor@example.org"}}')$$,
  '40001', null, 'stale version');
select is((select count(*)::int from public.admin_audit where entity_id = '00000000-0000-0000-0118-0000000000f1'), 1,
  'a failed save adds no audit row');

select * from finish();
rollback;
