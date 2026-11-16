-- SEC-04 / SEC-06: scan, rate-limit and dwell RPCs are server-only; one network cannot fake a live crowd.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.login(_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', _uid, 'role', 'authenticated')::text, true);
end;
$$;
create function pg_temp.anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
end;
$$;
create function pg_temp.root() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- ------------------------------------------------ grants
select ok(not has_function_privilege('anon', 'public.qr_record_scan(text, text, public.lang, float8, float8, text)', 'execute'), 'anon cannot record scans');
select ok(not has_function_privilege('authenticated', 'public.qr_record_scan(text, text, public.lang, float8, float8, text)', 'execute'), 'users cannot record scans');
select ok(has_function_privilege('service_role', 'public.qr_record_scan(text, text, public.lang, float8, float8, text)', 'execute'), 'the web server can');
select ok(not has_function_privilege('anon', 'public.rate_take(text, integer, integer)', 'execute'), 'anon cannot touch the limiter');
select ok(not has_function_privilege('authenticated', 'public.rate_take(text, integer, integer)', 'execute'), 'users cannot touch the limiter');
select ok(has_function_privilege('service_role', 'public.rate_take(text, integer, integer)', 'execute'), 'the web server can');
select ok(not has_function_privilege('authenticated', 'public.record_dwell(uuid, uuid, text, timestamptz, timestamptz)', 'execute'), 'users cannot record dwell rows');
select ok(not has_function_privilege('anon', 'public.record_dwell(uuid, uuid, text, timestamptz, timestamptz)', 'execute'), 'anon cannot record dwell rows');

insert into auth.users (id, email) values ('00000000-0000-0000-0113-0000000000a1', 'lsr@test.local');
create temp table ids as
select (select id from public.talukas where name_en = 'Ratnagiri') t, gen_random_uuid() one_net, gen_random_uuid() five_net;
grant select on ids to authenticated, anon;
-- Two places far from other fixtures (box 81.0–81.2 / 21.0–21.2).
insert into public.places (id, slug, category, taluka_id, location, status)
select one_net, 'lsr-one-net', 'beach'::public.place_category, t, 'SRID=4326;POINT(81.05 21.05)'::extensions.geography, 'published'::public.content_status from ids union all
select five_net, 'lsr-five-net', 'fort', t, 'SRID=4326;POINT(81.1 21.1)', 'published' from ids;
insert into public.qr_codes (code, entity_type, entity_id) select 'TSTP-9101', 'place', one_net from ids;
insert into public.qr_codes (code, entity_type, entity_id) select 'TSTP-9102', 'place', five_net from ids;

-- ------------------------------------------------ heatmap counts networks
-- Five different session cookies from ONE network (same client_key).
select public.qr_record_scan('TSTP-9101', md5(g::text) || md5(g::text), 'en', null, null, repeat('c', 64)) from generate_series(1, 5) g;
-- Five sessions from five networks.
select public.qr_record_scan('TSTP-9102', md5(g::text) || md5(g::text), 'en', null, null, md5('n' || g) || md5('n' || g)) from generate_series(1, 5) g;
select is((select count(*)::int from public.qr_scans where code = 'TSTP-9101'), 5, 'five forged sessions are stored');
select is((select count(*)::int from public.qr_scans where code = 'TSTP-9101' and client_key = repeat('c', 64)), 5, 'with their client key');
select throws_ok($$ select public.qr_record_scan('TSTP-9101', repeat('ab', 32), 'en', null, null, '203.0.113.7') $$, '22023', null, 'raw IPs are rejected as client keys');
select pg_temp.anon();
select ok(not exists (select 1 from public.map_heatmap(81, 21, 81.2, 21.2) where slug = 'lsr-one-net' and source = 'live'),
  'five scans sharing one client_key are not a live crowd');
select is((select source from public.map_heatmap(81, 21, 81.2, 21.2) where slug = 'lsr-five-net'), 'live', 'five networks are');
select throws_ok($$ select public.qr_record_scan('TSTP-9101', repeat('ab', 32), 'en', null, null) $$, '42501', null, 'anon call is denied');
select throws_ok($$ select public.rate_take(repeat('a', 64), 2, 600) $$, '42501', null, 'anon rate_take is denied');

-- ------------------------------------------------ dwell
select pg_temp.login('00000000-0000-0000-0113-0000000000a1');
insert into public.consents (user_id, type, granted, granted_at) values ('00000000-0000-0000-0113-0000000000a1', 'dwell_time', true, now());
select throws_ok($$ insert into public.dwell_events (anon_id, place_id, arrived_at, left_at) select gen_random_uuid()::text, one_net, now() - interval '1 hour', now() from ids $$,
  '42501', null, 'no direct dwell inserts, even with a self-granted consent');
select throws_ok($$ select public.record_dwell('00000000-0000-0000-0113-0000000000a1', (select one_net from ids), gen_random_uuid()::text, now() - interval '1 hour', now()) $$,
  '42501', null, 'users cannot call record_dwell');
select pg_temp.root();
select lives_ok($$ select public.record_dwell('00000000-0000-0000-0113-0000000000a1', (select one_net from ids), '11111111-1111-1111-1111-111111111111', now() - interval '1 hour', now()) $$,
  'server records a consented visit');
select public.record_dwell('00000000-0000-0000-0113-0000000000a1', (select one_net from ids), '11111111-1111-1111-1111-111111111111', now() - interval '50 minutes', now());
select is((select count(*)::int from public.dwell_events where anon_id = '11111111-1111-1111-1111-111111111111'), 1, 'one row per id, place and day');
select throws_ok($$ select public.record_dwell('00000000-0000-0000-0113-0000000000a1', (select one_net from ids), '22222222-2222-2222-2222-222222222222', now() - interval '2 days', now() - interval '47 hours') $$,
  '22023', null, 'visits older than 24 hours are refused');
select throws_ok($$ select public.record_dwell('00000000-0000-0000-0113-0000000000a1', (select one_net from ids), '22222222-2222-2222-2222-222222222222', now() - interval '11 hours', now()) $$,
  '22023', null, 'visits of 10 hours or more are refused');
select throws_ok($$ select public.record_dwell('00000000-0000-0000-0113-0000000000a1', (select one_net from ids), '22222222-2222-2222-2222-222222222222', now() - interval '1 hour', now() - interval '2 hours') $$,
  '22023', null, 'left must be after arrived');
update public.consents set granted = false, revoked_at = now() where user_id = '00000000-0000-0000-0113-0000000000a1';
select throws_ok($$ select public.record_dwell('00000000-0000-0000-0113-0000000000a1', (select five_net from ids), '33333333-3333-3333-3333-333333333333', now() - interval '1 hour', now()) $$,
  '42501', null, 'no consent, no row');

select * from finish();
rollback;
