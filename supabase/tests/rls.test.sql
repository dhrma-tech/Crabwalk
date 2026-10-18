-- RLS matrix tests (CRABWALK_BACKEND.md §4). Runs with `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- ---------------------------------------------------------------- identities
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

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'u1@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'u2@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'verifier@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'verifier2@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'reviewer@test.local'),
  ('00000000-0000-0000-0000-0000000000d1', 'owner@test.local'),
  ('00000000-0000-0000-0000-0000000000e1', 'admin@test.local');

-- ---------------------------------------------------------------- fixtures (as postgres)
create temp table ids as
select
  (select id from public.talukas where name_en = 'Ratnagiri') as t_rtn,
  (select id from public.talukas where name_en = 'Dapoli') as t_dap,
  gen_random_uuid() as p_pub, gen_random_uuid() as p_draft,
  gen_random_uuid() as s_own, gen_random_uuid() as s_other, gen_random_uuid() as e_pub,
  gen_random_uuid() as trip1;
grant select on ids to anon, authenticated;

insert into public.places (id, slug, category, taluka_id, location, status)
select p_pub, 't-pub', 'beach', t_rtn, 'SRID=4326;POINT(73.27 16.99)', 'published' from ids;
insert into public.places (id, slug, category, taluka_id, location, status)
select p_draft, 't-draft', 'fort', t_rtn, 'SRID=4326;POINT(73.28 17.00)', 'draft' from ids;

insert into public.stays (id, slug, taluka_id, location, price_min, price_max, status)
select s_own, 't-stay-own', t_rtn, 'SRID=4326;POINT(73.30 16.99)', 1000, 2000, 'published' from ids;
insert into public.stays (id, slug, taluka_id, location, price_min, price_max, status)
select s_other, 't-stay-other', t_rtn, 'SRID=4326;POINT(73.31 16.99)', 1000, 2000, 'published' from ids;

insert into public.eateries (id, slug, taluka_id, location, status)
select e_pub, 't-eatery', t_rtn, 'SRID=4326;POINT(73.30 16.98)', 'published' from ids;

insert into public.user_roles (user_id, role, taluka_id, entity_type, entity_id)
select '00000000-0000-0000-0000-0000000000b1', 'verifier', t_rtn, null, null from ids;
insert into public.user_roles (user_id, role, taluka_id, entity_type, entity_id)
select '00000000-0000-0000-0000-0000000000b2', 'verifier', t_dap, null, null from ids;
insert into public.user_roles (user_id, role, taluka_id, entity_type, entity_id)
select '00000000-0000-0000-0000-0000000000c1', 'reviewer', null, null, null from ids;
insert into public.user_roles (user_id, role, taluka_id, entity_type, entity_id)
select '00000000-0000-0000-0000-0000000000d1', 'owner', null, 'stay', s_own from ids;
insert into public.user_roles (user_id, role, taluka_id, entity_type, entity_id)
select '00000000-0000-0000-0000-0000000000e1', 'admin', null, null, null from ids;

insert into public.verdicts (user_id, entity_type, entity_id, group_type, level)
select '00000000-0000-0000-0000-0000000000a2', 'place', p_pub, 'family', 4 from ids;

insert into public.reviews (user_id, entity_type, entity_id, group_type, text, moderation_status)
select '00000000-0000-0000-0000-0000000000a2', 'place', p_pub, 'family', 'approved one', 'approved' from ids;
insert into public.reviews (user_id, entity_type, entity_id, group_type, text, moderation_status)
select '00000000-0000-0000-0000-0000000000a2', 'place', p_pub, 'couple', 'pending one', 'pending' from ids;

insert into public.verified_visits (user_id, entity_type, entity_id, method, distance_m)
select '00000000-0000-0000-0000-0000000000a2', 'eatery', e_pub, 'qr_gps', 50 from ids;

insert into public.reports (entity_type, entity_id, type, text)
select 'place', p_pub, 'garbage', 'fixture report' from ids;

insert into public.trips (id, owner_id, title, days, share_token)
select trip1, '00000000-0000-0000-0000-0000000000a1', 'u1 trip', 2, 'tok-u1' from ids;

insert into public.ai_usage (user_id, date, message_count) values
  ('00000000-0000-0000-0000-0000000000a1', current_date, 3),
  ('00000000-0000-0000-0000-0000000000a2', current_date, 5);

insert into public.sponsors (name, entity_type, entity_id)
select 'Fixture sponsor', 'stay', s_other from ids;

-- ================================================================ published listings
select pg_temp.anon();
select is((select count(*)::int from public.places where slug = 't-pub'), 1, 'anon reads published place');
select is((select count(*)::int from public.places where slug = 't-draft'), 0, 'anon cannot read draft place');
select throws_ok(
  $$ insert into public.places (slug, category, taluka_id, location)
     select 'anon-x', 'beach', t_rtn, 'SRID=4326;POINT(73 17)' from ids $$,
  '42501', null, 'anon cannot insert place');

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.places where slug = 't-draft'), 0, 'user cannot read draft place');
select throws_ok(
  $$ insert into public.places (slug, category, taluka_id, location)
     select 'user-x', 'beach', t_rtn, 'SRID=4326;POINT(73 17)' from ids $$,
  '42501', null, 'user cannot insert place');

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from public.places where slug = 't-draft'), 1, 'verifier reads draft in own taluka');
select lives_ok(
  $$ insert into public.places (slug, category, taluka_id, location)
     select 'ver-new', 'temple', t_rtn, 'SRID=4326;POINT(73.3 17)' from ids $$,
  'verifier inserts draft in own taluka');
select throws_ok(
  $$ insert into public.places (slug, category, taluka_id, location)
     select 'ver-other', 'temple', t_dap, 'SRID=4326;POINT(73.2 17.7)' from ids $$,
  '42501', null, 'verifier cannot insert in another taluka');
select throws_ok(
  $$ update public.places set status = 'published' where slug = 't-draft' $$,
  '42501', null, 'verifier cannot publish');

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000b2');
with u as (update public.places set entry_fee_text = 'x' where slug = 't-draft' returning 1)
select is(count(*)::int, 0, 'verifier of other taluka cannot update') from u;

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
with u as (update public.places set status = 'published' where slug = 't-draft' returning 1)
select is(count(*)::int, 1, 'reviewer publishes') from u;

-- owner: fact fields only, own listing only
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
with u as (update public.stays set price_min = 1200, phone = '9999999999' where slug = 't-stay-own' returning 1)
select is(count(*)::int, 1, 'owner edits prices/contact on own listing') from u;
select throws_ok(
  $$ update public.stays set is_verified = true where slug = 't-stay-own' $$,
  '42501', null, 'owner cannot set is_verified');
select throws_ok(
  $$ update public.stays set slug = 'renamed' where slug = 't-stay-own' $$,
  '42501', null, 'owner cannot edit non-fact fields');
with u as (update public.stays set price_min = 1 where slug = 't-stay-other' returning 1)
select is(count(*)::int, 0, 'owner cannot edit another listing') from u;

-- ================================================================ verdicts / sub_scores
reset role;
select pg_temp.anon();
select is((select count(*)::int from public.verdicts), 0, 'anon cannot read individual verdicts');
select lives_ok($$ select * from public.verdict_agg $$, 'anon reads verdict_agg');
select throws_ok(
  $$ insert into public.verdicts (user_id, entity_type, entity_id, group_type, level)
     select '00000000-0000-0000-0000-0000000000a1', 'place', p_pub, 'solo', 3 from ids $$,
  '42501', null, 'anon cannot vote');

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select lives_ok(
  $$ insert into public.verdicts (user_id, entity_type, entity_id, group_type, level)
     select '00000000-0000-0000-0000-0000000000a1', 'place', p_pub, 'solo', 3 from ids $$,
  'user writes own verdict');
select throws_ok(
  $$ insert into public.verdicts (user_id, entity_type, entity_id, group_type, level)
     select '00000000-0000-0000-0000-0000000000a2', 'place', p_pub, 'couple', 1 from ids $$,
  '42501', null, 'user cannot vote as someone else');
select is((select count(*)::int from public.verdicts), 1, 'user sees only own verdicts');
select throws_ok(
  $$ insert into public.sub_scores (user_id, entity_type, entity_id, dimension, score)
     select '00000000-0000-0000-0000-0000000000a1', 'eatery', e_pub, 'hygiene', 5 from ids $$,
  '42501', null, 'unverified user cannot submit hygiene');
select lives_ok(
  $$ insert into public.sub_scores (user_id, entity_type, entity_id, dimension, score)
     select '00000000-0000-0000-0000-0000000000a1', 'eatery', e_pub, 'taste', 4 from ids $$,
  'user submits taste without verification');

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select lives_ok(
  $$ insert into public.sub_scores (user_id, entity_type, entity_id, dimension, score)
     select '00000000-0000-0000-0000-0000000000a2', 'eatery', e_pub, 'hygiene', 5 from ids $$,
  'verified visitor submits hygiene');

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select throws_ok(
  $$ insert into public.verdicts (user_id, entity_type, entity_id, group_type, level)
     select '00000000-0000-0000-0000-0000000000d1', 'stay', s_own, 'family', 4 from ids $$,
  '42501', null, 'owner cannot rate own listing');
select lives_ok(
  $$ insert into public.verdicts (user_id, entity_type, entity_id, group_type, level)
     select '00000000-0000-0000-0000-0000000000d1', 'stay', s_other, 'family', 3 from ids $$,
  'owner can rate another listing');
select throws_ok(
  $$ insert into public.verdict_agg (entity_type, entity_id, group_type) select 'stay', s_own, 'family' from ids $$,
  '42501', null, 'owner cannot write verdict_agg');
select throws_ok(
  $$ insert into public.reviews (user_id, entity_type, entity_id, group_type, text)
     select '00000000-0000-0000-0000-0000000000d1', 'stay', s_own, 'family', 'great' from ids $$,
  '42501', null, 'owner cannot review own listing');

-- ================================================================ reviews
reset role;
select pg_temp.anon();
select is((select count(*)::int from public.reviews where entity_id = (select p_pub from ids)), 1, 'anon reads approved reviews only');

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select lives_ok(
  $$ insert into public.reviews (user_id, entity_type, entity_id, group_type, text)
     select '00000000-0000-0000-0000-0000000000a1', 'place', p_pub, 'solo', 'nice' from ids $$,
  'user writes own review (pending)');
select throws_ok(
  $$ insert into public.reviews (user_id, entity_type, entity_id, group_type, text, moderation_status)
     select '00000000-0000-0000-0000-0000000000a1', 'place', p_pub, 'solo', 'x', 'approved' from ids $$,
  '42501', null, 'user cannot self-approve review');
with u as (update public.reviews set moderation_status = 'approved' where text = 'pending one' returning 1)
select is(count(*)::int, 0, 'user cannot moderate') from u;

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
with u as (update public.reviews set moderation_status = 'approved' where text = 'pending one' returning 1)
select is(count(*)::int, 1, 'reviewer moderates') from u;

-- ================================================================ reports
reset role;
select pg_temp.anon();
select lives_ok(
  $$ insert into public.reports (entity_type, entity_id, type) select 'place', p_pub, 'broken_qr' from ids $$,
  'anon files report');
select is((select count(*)::int from public.reports), 0, 'anon cannot read reports');

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select lives_ok(
  $$ insert into public.reports (entity_type, entity_id, type) select 'place', p_pub, 'garbage' from ids $$,
  'user files report');

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select ok((select count(*) from public.reports) >= 1, 'verifier reads reports in own taluka');
with u as (update public.reports set status = 'triaged' where text = 'fixture report' returning 1)
select is(count(*)::int, 1, 'verifier triages own taluka') from u;

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000b2');
select is((select count(*)::int from public.reports), 0, 'verifier of other taluka sees no reports');

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
select ok((select count(*) from public.reports) >= 1, 'reviewer reads reports');

-- ================================================================ trips + group votes
reset role;
select pg_temp.anon();
select is((select count(*)::int from public.trips where id = (select trip1 from ids)), 0, 'anon cannot list trips');
select isnt(public.get_shared_trip('tok-u1'), null, 'anon reads trip via share token');
select is(public.get_shared_trip('bad-token'), null, 'bad token returns nothing');
select lives_ok(
  $$ select public.cast_group_vote('tok-u1', 'guest-1', 'Asha', gen_random_uuid(), 'up') $$,
  'guest votes with valid token');
select throws_ok(
  $$ select public.cast_group_vote('bad-token', 'guest-1', 'Asha', gen_random_uuid(), 'up') $$,
  '42501', null, 'guest vote with bad token rejected');
select throws_ok(
  $$ insert into public.group_votes (trip_id, voter_token, entity_id, vote)
     select trip1, 'g', gen_random_uuid(), 'up' from ids $$,
  '42501', null, 'direct guest insert rejected');

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.trips where id = (select trip1 from ids)), 1, 'owner reads own trip');
select is((select count(*)::int from public.group_votes), 1, 'trip owner reads votes');
with u as (update public.trips set title = 'renamed' where id = (select trip1 from ids) returning 1)
select is(count(*)::int, 1, 'owner updates own trip') from u;

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select is((select count(*)::int from public.trips where id = (select trip1 from ids)), 0, 'other user cannot read trip');
select is((select count(*)::int from public.group_votes), 0, 'other user cannot read votes');

-- ================================================================ AI tables
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select is((select message_count from public.ai_usage), 3, 'user reads only own ai_usage');
select throws_ok(
  $$ insert into public.ai_usage (user_id, date, message_count)
     values ('00000000-0000-0000-0000-0000000000a1', current_date + 1, 0) $$,
  '42501', null, 'user cannot write ai_usage');

-- ================================================================ dwell_events
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$ insert into public.dwell_events (anon_id, place_id, arrived_at) select gen_random_uuid()::text, p_pub, now() from ids $$,
  '42501', null, 'no dwell rows without consent');
insert into public.consents (user_id, type, granted, granted_at)
values ('00000000-0000-0000-0000-0000000000a1', 'dwell_time', true, now());
select lives_ok(
  $$ insert into public.dwell_events (anon_id, place_id, arrived_at) select gen_random_uuid()::text, p_pub, now() from ids $$,
  'dwell row allowed with consent');
select is((select count(*)::int from public.dwell_events), 0, 'user cannot read dwell_events');
update public.consents set revoked_at = now() where user_id = '00000000-0000-0000-0000-0000000000a1';
select throws_ok(
  $$ insert into public.dwell_events (anon_id, place_id, arrived_at) select 'y', p_pub, now() from ids $$,
  '42501', null, 'no dwell rows after consent revoked');

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000e1');
select is((select count(*)::int from public.dwell_events), 1, 'admin reads dwell_events');

-- ================================================================ sponsors
reset role;
select pg_temp.anon();
select lives_ok($$ select name from public.sponsors $$, 'anon reads sponsor name');
select throws_ok($$ select entity_id from public.sponsors $$, '42501', null, 'anon cannot read sponsor details');

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$ select * from public.sponsors $$, 'user reads sponsors');
select throws_ok(
  $$ insert into public.sponsors (name) values ('x') $$, '42501', null, 'user cannot write sponsors');

-- ================================================================ roles
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$ insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000a1', 'admin') $$,
  '42501', null, 'user cannot grant self a role');

reset role;
select * from finish();
rollback;
