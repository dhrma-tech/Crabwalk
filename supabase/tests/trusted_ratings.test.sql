-- SEC-03: guest (anonymous) votes are stored but not counted; visits are verified by the web server only,
-- with an accuracy limit and a velocity rule.
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
create function pg_temp.root() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0114-0000000000a1', 'tr-real@test.local', false),
  ('00000000-0000-0000-0114-0000000000b1', null, true);
create temp table ids as
select (select id from public.talukas where name_en = 'Ratnagiri') t,
       gen_random_uuid() place, gen_random_uuid() eat, gen_random_uuid() far;
grant select on ids to authenticated, anon;
-- `far` is about 110 km north of the other two.
insert into public.places (id, slug, category, taluka_id, location, status)
select place, 'tr-place', 'fort'::public.place_category, t, 'SRID=4326;POINT(81.3 21)'::extensions.geography, 'published'::public.content_status from ids union all
select far, 'tr-far', 'beach', t, 'SRID=4326;POINT(81.3 22)', 'published' from ids;
insert into public.eateries (id, slug, taluka_id, location, status)
select eat, 'tr-eat', t, 'SRID=4326;POINT(81.3 21)', 'published' from ids;
insert into public.qr_codes (code, entity_type, entity_id) select 'TSTP-9201', 'place', place from ids;
insert into public.qr_codes (code, entity_type, entity_id) select 'TSTP-9202', 'place', far from ids;

-- ------------------------------------------------ real vs guest
select pg_temp.login('00000000-0000-0000-0114-0000000000a1');
select is(app.is_real_user(), true, 'a signed-in account is a real user');
insert into public.verdicts (user_id, entity_type, entity_id, group_type, level)
select '00000000-0000-0000-0114-0000000000a1', 'place', place, 'family', 4 from ids;
insert into public.sub_scores (user_id, entity_type, entity_id, dimension, score)
select '00000000-0000-0000-0114-0000000000a1', 'eatery', eat, 'taste', 4 from ids;

select pg_temp.login('00000000-0000-0000-0114-0000000000b1', true);
select is(app.is_real_user(), false, 'an anonymous session is not');
-- The guest even asks for counted = true.
insert into public.verdicts (user_id, entity_type, entity_id, group_type, level, counted)
select '00000000-0000-0000-0114-0000000000b1', 'place', place, 'family', 1, true from ids;
insert into public.sub_scores (user_id, entity_type, entity_id, dimension, score, counted)
select '00000000-0000-0000-0114-0000000000b1', 'eatery', eat, 'taste', 1, true from ids;
select is((select counted from public.verdicts where user_id = '00000000-0000-0000-0114-0000000000b1'), false,
  'a guest verdict is stored but not counted');
update public.verdicts set counted = true, level = 2 where user_id = '00000000-0000-0000-0114-0000000000b1';
select is((select counted from public.verdicts where user_id = '00000000-0000-0000-0114-0000000000b1'), false,
  'a guest cannot switch counted on');
select is((select total from public.verdict_agg where entity_id = (select place from ids) and group_type = 'family'), 1,
  'the guest verdict does not change verdict_agg');
select is((select counts from public.verdict_agg where entity_id = (select place from ids) and group_type = 'family'),
  array[0, 0, 0, 1], 'only the real vote is in the counts');
select is((select n from public.sub_score_summary('eatery', (select eat from ids)) where dimension = 'taste'), 1,
  'the guest sub-score is not in the summary');
select is((select avg_score from public.sub_score_summary('eatery', (select eat from ids)) where dimension = 'taste'), 4.0,
  'the average is the real score');

-- ------------------------------------------------ recount when a guest becomes a real account
select pg_temp.root();
select ok(not has_function_privilege('authenticated', 'app.recount_user(uuid)', 'execute'), 'users cannot recount');
update auth.users set is_anonymous = false where id = '00000000-0000-0000-0114-0000000000b1';
select app.recount_user('00000000-0000-0000-0114-0000000000b1');
select is((select total from public.verdict_agg where entity_id = (select place from ids) and group_type = 'family'), 2,
  'after linking an identity the vote counts');
select is((select n from public.sub_score_summary('eatery', (select eat from ids)) where dimension = 'taste'), 2,
  'and so does the sub-score');

-- ------------------------------------------------ verified visit: server only
select ok(not has_function_privilege('anon', 'public.qr_verify_visit(uuid, text, float8, float8, integer, text)', 'execute'), 'anon cannot verify visits');
select ok(not has_function_privilege('authenticated', 'public.qr_verify_visit(uuid, text, float8, float8, integer, text)', 'execute'), 'users cannot verify visits');
select ok(has_function_privilege('service_role', 'public.qr_verify_visit(uuid, text, float8, float8, integer, text)', 'execute'), 'the web server can');
select pg_temp.login('00000000-0000-0000-0114-0000000000a1');
select throws_ok($$ select * from public.qr_verify_visit('00000000-0000-0000-0114-0000000000a1', 'TSTP-9201', 21, 81.3, 10, null) $$,
  '42501', null, 'a direct call with a user JWT is denied');
select pg_temp.root();

select is((select verified from public.qr_verify_visit('00000000-0000-0000-0114-0000000000a1', 'TSTP-9201', 21, 81.3, 500, repeat('c', 64))), false,
  'accuracy 500 m is not verified');
select is((select verified from public.qr_verify_visit('00000000-0000-0000-0114-0000000000a1', 'TSTP-9201', 21, 81.3, null, repeat('c', 64))), false,
  'unknown accuracy is not verified');
select is((select count(*)::int from public.verified_visits where user_id = '00000000-0000-0000-0114-0000000000a1'), 0,
  'refused checks store nothing');
select throws_ok($$ select * from public.qr_verify_visit('00000000-0000-0000-0114-0000000000a1', 'TSTP-9201', 21, 81.3, 10, '203.0.113.7') $$,
  '22023', null, 'raw IPs are rejected as client keys');
select is((select verified from public.qr_verify_visit('00000000-0000-0000-0114-0000000000a1', 'TSTP-9201', 21, 81.3, 50, repeat('c', 64))), true,
  'accuracy 50 m at the spot is verified');
select is((select accuracy_m from public.verified_visits where user_id = '00000000-0000-0000-0114-0000000000a1'), 50, 'accuracy stored');
select is((select client_key from public.verified_visits where user_id = '00000000-0000-0000-0114-0000000000a1'), repeat('c', 64), 'client key stored');

-- Velocity: 110 km away within 30 minutes is refused; after 31 minutes it is fine.
select is((select verified from public.qr_verify_visit('00000000-0000-0000-0114-0000000000a1', 'TSTP-9202', 22, 81.3, 10, null)), false,
  'a second spot 110 km away minutes later is not verified');
update public.verified_visits set created_at = now() - interval '31 minutes' where user_id = '00000000-0000-0000-0114-0000000000a1';
select is((select verified from public.qr_verify_visit('00000000-0000-0000-0114-0000000000a1', 'TSTP-9202', 22, 81.3, 10, null)), true,
  'the same check passes once 30 minutes have gone by');
select is((select count(*)::int from public.verified_visits where user_id = '00000000-0000-0000-0114-0000000000a1' and method = 'qr_gps'), 2,
  'both visits stored');

select * from finish();
rollback;
