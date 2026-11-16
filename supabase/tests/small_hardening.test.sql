-- Hardening 2026-11: shared-trip fields (SEC-17), push endpoints (SEC-13), email invites (SEC-07), QR code
-- columns (SEC-19), map search wildcards (SEC-25), booking links (SEC-27).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.login(_uid uuid, _anonymous boolean default false) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', _uid, 'role', 'authenticated', 'is_anonymous', _anonymous)::text, true);
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

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0116-0000000000a1', 'sh-owner@test.local', false),
  ('00000000-0000-0000-0116-0000000000a2', 'sh-friend@test.local', false),
  ('00000000-0000-0000-0116-0000000000b1', null, true);
create temp table ids as
select (select id from public.talukas where name_en = 'Ratnagiri') t, gen_random_uuid() trip, gen_random_uuid() guest_trip,
       gen_random_uuid() stay;
grant select on ids to authenticated, anon;

-- ------------------------------------------------ SEC-17: shared trip
select pg_temp.login('00000000-0000-0000-0116-0000000000a1');
insert into public.trips (id, owner_id, title, days, start_point, share_token)
select trip, '00000000-0000-0000-0116-0000000000a1', 'SH trip', 2,
  jsonb_build_object('label', 'Home', 'lon', 73.301234, 'lat', 16.991234), repeat('a', 32) from ids;
select is((select display_name from public.trip_members where trip_id = (select trip from ids)), 'Me',
  'the owner row is named Me, not after the email');
select pg_temp.anon();
select is(
  (select array_agg(k order by k) from jsonb_object_keys(public.get_shared_trip(repeat('a', 32)) -> 'trip') k),
  array['days', 'group_type', 'id', 'pace', 'start_date', 'start_label', 'status', 'title'],
  'the shared trip has exactly the allowed keys');
select is(public.get_shared_trip(repeat('a', 32)) #>> '{trip,start_label}', 'Home', 'start point as a label');
select ok(public.get_shared_trip(repeat('a', 32))::text !~ '73\.30|16\.99', 'no start coordinates anywhere');

-- ------------------------------------------------ SEC-07: email invites
select pg_temp.login('00000000-0000-0000-0116-0000000000a1');
select is(public.add_trip_member_by_email((select trip from ids), 'nobody@test.local', 'viewer'), true,
  'unknown address: true as well (no account oracle)');
select is((select count(*)::int from public.trip_members where trip_id = (select trip from ids)), 1, 'and nobody added');
select is(public.add_trip_member_by_email((select trip from ids), 'SH-Friend@test.local', 'editor'), true, 'known address');
select is((select display_name from public.trip_members where user_id = '00000000-0000-0000-0116-0000000000a2'), 'Tripmate',
  'added tripmate is not named after the email');
select pg_temp.login('00000000-0000-0000-0116-0000000000b1', true);
insert into public.trips (id, owner_id, title, days)
select guest_trip, '00000000-0000-0000-0116-0000000000b1', 'Guest trip', 1 from ids;
select throws_ok($$ select public.add_trip_member_by_email((select guest_trip from ids), 'sh-friend@test.local', 'viewer') $$,
  '42501', null, 'a guest cannot invite by email');

-- ------------------------------------------------ SEC-13: push endpoints
select pg_temp.root();
insert into public.consents (user_id, type, granted, granted_at) values ('00000000-0000-0000-0116-0000000000a1', 'push', true, now());
select throws_ok($$ insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values ('00000000-0000-0000-0116-0000000000a1', 'https://example.com/hook', 'k', 'a') $$, '23514', null,
  'an endpoint outside the push services is refused');
select throws_ok($$ insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values ('00000000-0000-0000-0116-0000000000a1', 'https://fcm.googleapis.com.evil.example/x', 'k', 'a') $$, '23514', null,
  'a look-alike host is refused');
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
select '00000000-0000-0000-0116-0000000000a1', 'https://fcm.googleapis.com/fcm/send/sh-' || g, 'k', 'a' from generate_series(1, 10) g;
select is((select count(*)::int from public.push_subscriptions where user_id = '00000000-0000-0000-0116-0000000000a1'), 10,
  'ten devices allowed');
select throws_ok($$ insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values ('00000000-0000-0000-0116-0000000000a1', 'https://web.push.apple.com/sh-11', 'k', 'a') $$, '54000', null,
  'the eleventh is refused');
select lives_ok($$ insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values ('00000000-0000-0000-0116-0000000000a1', 'https://fcm.googleapis.com/fcm/send/sh-1', 'k2', 'a2')
  on conflict (endpoint) do update set p256dh = excluded.p256dh $$, 're-subscribing a known device still works');

-- ------------------------------------------------ SEC-19: QR code columns
insert into public.qr_codes (code, entity_type, entity_id, permission_body)
select 'TSTP-9301', 'place', (select id from public.places limit 1), 'Gram panchayat letter 12' from ids;
select pg_temp.anon();
select is((select code from public.qr_codes where code = 'TSTP-9301'), 'TSTP-9301', 'anon reads the public columns');
select throws_ok($$ select permission_body from public.qr_codes where code = 'TSTP-9301' $$, '42501', null,
  'anon cannot read permission notes');
select pg_temp.login('00000000-0000-0000-0116-0000000000a1');
select throws_ok($$ select installed_at from public.qr_codes limit 1 $$, '42501', null, 'nor can a signed-in user');

-- ------------------------------------------------ SEC-25: map search
select pg_temp.anon();
select is((select count(*)::int from public.map_search('%%')), 0, '%% matches nothing (literal percent signs)');
select is((select count(*)::int from public.map_search('__')), 0, '__ matches nothing');
select is((select count(*)::int from public.map_search(repeat('a', 61))), 0, 'more than 60 characters: nothing');
select ok((select count(*)::int from public.map_search('Seed')) > 0, 'a normal search still finds listings');

-- ------------------------------------------------ SEC-27: booking links
select pg_temp.root();
insert into public.stays (id, slug, taluka_id, location, status)
select stay, 'sh-stay', t, 'SRID=4326;POINT(73.3 17)', 'draft' from ids;
select throws_ok($$ insert into public.stay_offers (stay_id, provider, deep_link) select stay, 'x', 'javascript:alert(1)' from ids $$,
  '23514', null, 'a javascript: booking link is refused');
select lives_ok($$ insert into public.stay_offers (stay_id, provider, deep_link) select stay, 'x', 'https://partner.example/h/1' from ids $$,
  'an https link is fine');

select * from finish();
rollback;
