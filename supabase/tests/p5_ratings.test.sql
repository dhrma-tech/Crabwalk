-- P5: verdict aggregation (winner/%/count, tie, New < 10, All), verified-only hygiene/cleanliness,
-- dimension rules, booking-proof approval, review edits.
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

-- 12 voters (u01..u12), one verifier.
insert into auth.users (id, email)
select ('00000000-0000-0000-0005-0000000000' || lpad(i::text, 2, '0'))::uuid, 'p5u' || i || '@test.local' from generate_series(1, 12) i;
insert into auth.users (id, email) values ('00000000-0000-0000-0005-0000000000b1', 'p5v@test.local');
create function pg_temp.u(i int) returns uuid language sql as $$ select ('00000000-0000-0000-0005-0000000000' || lpad(i::text, 2, '0'))::uuid $$;

create temp table ids as
select (select id from public.talukas where name_en = 'Ratnagiri') t, gen_random_uuid() place, gen_random_uuid() eat, gen_random_uuid() stay, gen_random_uuid() proof;
grant select on ids to authenticated;
insert into public.places (id, slug, category, taluka_id, location, status) select place, 'p5-place', 'fort', t, 'SRID=4326;POINT(73.3 17)', 'published' from ids;
insert into public.eateries (id, slug, taluka_id, location, status) select eat, 'p5-eat', t, 'SRID=4326;POINT(73.3 17)', 'published' from ids;
insert into public.stays (id, slug, taluka_id, location, status) select stay, 'p5-stay', t, 'SRID=4326;POINT(73.3 17)', 'published' from ids;
insert into public.user_roles (user_id, role, taluka_id) select '00000000-0000-0000-0005-0000000000b1', 'verifier', t from ids;

-- Family votes on the place: levels 4,4,3,3,2 → tie 4 vs 3 → higher wins (C19).
do $$ declare l int[] := array[4, 4, 3, 3, 2]; begin
  for i in 1..5 loop
    perform pg_temp.login(pg_temp.u(i));
    insert into public.verdicts (user_id, entity_type, entity_id, group_type, level)
    select pg_temp.u(i), 'place', place, 'family', l[i] from ids;
  end loop;
end $$;
select pg_temp.root();
select is((select counts from public.verdict_agg where entity_id = (select place from ids) and group_type = 'family'), '{0,1,2,2}'::int[], 'counts per level');
select is((select total from public.verdict_agg where entity_id = (select place from ids) and group_type = 'family'), 5, 'total');
select is((select winner_level from public.verdict_agg where entity_id = (select place from ids) and group_type = 'family'), 4::smallint, 'tie → higher level wins');
select is((select winner_pct from public.verdict_agg where entity_id = (select place from ids) and group_type = 'family'), 0.4000, 'winner % = max/total');
select ok((select is_new from public.verdict_agg where entity_id = (select place from ids) and group_type = 'family'), 'New below 10 votes');

-- Editable: u5 changes 2 → 3 → 3 now wins outright (3 votes vs 2).
select pg_temp.login(pg_temp.u(5));
update public.verdicts set level = 3 where user_id = pg_temp.u(5);
select pg_temp.root();
select is((select winner_level from public.verdict_agg where entity_id = (select place from ids) and group_type = 'family'), 3::smallint, 'edit moves the winner');
select is((select counts from public.verdict_agg where entity_id = (select place from ids) and group_type = 'family'), '{0,0,3,2}'::int[], 'edit moves the count');

-- One verdict per user per group type; another group type is separate.
select pg_temp.login(pg_temp.u(1));
select throws_ok($$ insert into public.verdicts (user_id, entity_type, entity_id, group_type, level) select pg_temp.u(1), 'place', place, 'family', 1 from ids $$,
  '23505', null, 'one verdict per user per item per group type');
select lives_ok($$ insert into public.verdicts (user_id, entity_type, entity_id, group_type, level) select pg_temp.u(1), 'place', place, 'couple', 1 from ids $$,
  'same user can vote for another group type');

-- Couple reaches 10+ votes → not New; All sums groups.
do $$ begin
  for i in 2..10 loop
    perform pg_temp.login(pg_temp.u(i));
    insert into public.verdicts (user_id, entity_type, entity_id, group_type, level) select pg_temp.u(i), 'place', place, 'couple', 2 from ids;
  end loop;
end $$;
select pg_temp.root();
select is((select total from public.verdict_agg where entity_id = (select place from ids) and group_type = 'couple'), 10, 'couple total 10');
select ok(not (select is_new from public.verdict_agg where entity_id = (select place from ids) and group_type = 'couple'), 'not New at 10 votes');
select is((select counts from public.verdict_agg_all where entity_id = (select place from ids)), '{1,9,3,2}'::int[], 'All = sum across groups');
select is((select total from public.verdict_agg_all where entity_id = (select place from ids)), 15, 'All total');
select is((select winner_level from public.verdict_agg_all where entity_id = (select place from ids)), 2::smallint, 'All winner');

-- Delete clears an empty group.
select pg_temp.login(pg_temp.u(1));
delete from public.verdicts where user_id = pg_temp.u(1) and group_type = 'couple';
select pg_temp.root();
select is((select total from public.verdict_agg where entity_id = (select place from ids) and group_type = 'couple'), 9, 'delete recomputes');

-- ---------------------------------------------------------------- sub-scores
select pg_temp.login(pg_temp.u(11));
select lives_ok($$ insert into public.sub_scores (user_id, entity_type, entity_id, dimension, score) select pg_temp.u(11), 'eatery', eat, 'taste', 5 from ids $$, 'taste on eatery ok');
select throws_ok($$ insert into public.sub_scores (user_id, entity_type, entity_id, dimension, score) select pg_temp.u(11), 'eatery', eat, 'hygiene', 4 from ids $$,
  '42501', null, 'unverified user cannot rate hygiene');
select throws_ok($$ insert into public.sub_scores (user_id, entity_type, entity_id, dimension, score) select pg_temp.u(11), 'stay', stay, 'cleanliness', 4 from ids $$,
  '42501', null, 'unverified user cannot rate cleanliness');
select throws_ok($$ insert into public.sub_scores (user_id, entity_type, entity_id, dimension, score) select pg_temp.u(11), 'eatery', eat, 'host', 4 from ids $$,
  '23514', null, 'stay dimension rejected on eatery');
select throws_ok($$ insert into public.sub_scores (user_id, entity_type, entity_id, dimension, score) select pg_temp.u(11), 'place', place, 'value', 4 from ids $$,
  '23514', null, 'places have no sub-scores');
select throws_ok($$ insert into public.verified_visits (user_id, entity_type, entity_id, method) select pg_temp.u(11), 'stay', stay, 'qr_gps' from ids $$,
  '42501', null, 'users cannot self-verify a visit');

-- Booking proof → verifier approves → cleanliness unlocked for that user and stay only.
insert into public.booking_proofs (id, user_id, entity_type, entity_id, storage_path)
select proof, pg_temp.u(11), 'stay', stay, pg_temp.u(11) || '/x.jpg' from ids;
select throws_ok($$ select public.review_booking_proof((select proof from ids), true) $$, '42501', null, 'user cannot approve own proof');
select pg_temp.login('00000000-0000-0000-0005-0000000000b1');
select lives_ok($$ select public.review_booking_proof((select proof from ids), true) $$, 'taluka verifier approves proof');
select pg_temp.root();
select is((select storage_path from public.booking_proofs where id = (select proof from ids)), null, 'proof image path cleared after review');
select ok(exists (select 1 from public.verified_visits where user_id = pg_temp.u(11) and method = 'booking_proof'), 'verified visit recorded');
select pg_temp.login(pg_temp.u(11));
select lives_ok($$ insert into public.sub_scores (user_id, entity_type, entity_id, dimension, score) select pg_temp.u(11), 'stay', stay, 'cleanliness', 4 from ids $$,
  'verified visitor can rate cleanliness');
select throws_ok($$ insert into public.sub_scores (user_id, entity_type, entity_id, dimension, score) select pg_temp.u(11), 'eatery', eat, 'hygiene', 4 from ids $$,
  '42501', null, 'verification is per listing');
select is((select avg_score from public.sub_score_summary('stay', (select stay from ids)) where dimension = 'cleanliness'), 4.0, 'summary averages per dimension');

-- ---------------------------------------------------------------- reviews
select lives_ok($$ insert into public.reviews (user_id, entity_type, entity_id, group_type, text) select pg_temp.u(11), 'stay', stay, 'solo', 'nice' from ids $$, 'review queued');
select throws_ok($$ insert into public.reviews (user_id, entity_type, entity_id, group_type, text) select pg_temp.u(11), 'stay', stay, 'solo', 'again' from ids $$,
  '23505', null, 'one review per user/listing/group');
select pg_temp.root();
update public.reviews set moderation_status = 'approved' where user_id = pg_temp.u(11);
select pg_temp.login(pg_temp.u(11));
select throws_ok($$ update public.reviews set text = 'edited', moderation_status = 'approved' where user_id = pg_temp.u(11) $$,
  '42501', null, 'author cannot self-approve an edit');
with u as (update public.reviews set text = 'edited', moderation_status = 'pending' where user_id = pg_temp.u(11) returning 1)
select is(count(*)::int, 1, 'edit goes back to moderation') from u;
select pg_temp.login(pg_temp.u(12));
select is((select count(*)::int from public.reviews where entity_id = (select stay from ids)), 0, 'pending review hidden from others');

select * from finish();
rollback;
