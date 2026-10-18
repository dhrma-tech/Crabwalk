-- P7: trip privacy, guest votes without login, published routes (review → public), reviewer read RPC,
-- planner matrix lookup, alerted places, config tables.
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

insert into auth.users (id, email) values
  ('00000000-0000-0000-0007-0000000000a1', 'p7owner@test.local'),
  ('00000000-0000-0000-0007-0000000000a2', 'p7other@test.local'),
  ('00000000-0000-0000-0007-0000000000b1', 'p7reviewer@test.local');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0007-0000000000b1', 'reviewer');

create temp table ids as
select (select id from public.talukas where name_en = 'Ratnagiri') t, gen_random_uuid() p1, gen_random_uuid() p2, gen_random_uuid() trip;
grant select on ids to anon, authenticated;
insert into public.places (id, slug, category, taluka_id, location, status, visit_minutes, entry_fee_inr)
select p1, 'p7-a', 'fort', t, 'SRID=4326;POINT(73.3 17)', 'published', 90, 25 from ids;
insert into public.places (id, slug, category, taluka_id, location, status)
select p2, 'p7-b', 'beach', t, 'SRID=4326;POINT(73.31 17.01)', 'published' from ids;
insert into public.matrix_points (entity_type, entity_id, location)
select 'place'::public.entity_type, p1, 'SRID=4326;POINT(73.3 17)'::extensions.geography from ids union all select 'place', p2, 'SRID=4326;POINT(73.31 17.01)' from ids;
insert into public.travel_matrix (from_point_id, to_point_id, duration_s, distance_m, duration_corrected_s)
select a.id, b.id, 600, 2000, 720 from public.matrix_points a, public.matrix_points b, ids
where a.entity_id = ids.p1 and b.entity_id = ids.p2;

select pg_temp.login('00000000-0000-0000-0007-0000000000a1');
insert into public.trips (id, owner_id, title, days, start_date, start_point)
select trip, '00000000-0000-0000-0007-0000000000a1', 'P7 trip', 1, '2026-11-01', '{"label":"X","lon":73.3,"lat":17}' from ids;
insert into public.trip_stops (trip_id, day, "order", entity_type, entity_id, kind)
select trip, 1, 0, 'place', p1, 'place' from ids;

-- ------------------------------------------------ privacy
select pg_temp.login('00000000-0000-0000-0007-0000000000a2');
select is((select count(*)::int from public.trips where id = (select trip from ids)), 0, 'other users cannot read a private trip');
select pg_temp.anon();
select is((select count(*)::int from public.trip_stops where trip_id = (select trip from ids)), 0, 'anon cannot read private stops');

-- ------------------------------------------------ share + guest vote (no login)
select pg_temp.root();
create temp table tok as select share_token from public.trips where id = (select trip from ids);
grant select on tok to anon, authenticated;
select pg_temp.anon();
select ok((public.get_shared_trip((select share_token from tok)) -> 'trip' ->> 'title') = 'P7 trip', 'anon reads the shared trip by token');
select ok(not (public.get_shared_trip((select share_token from tok)) -> 'trip') ? 'owner_id', 'shared payload has no owner id');
select lives_ok($$ select public.cast_group_vote((select share_token from tok), 'guest-1', 'Asha', (select p1 from ids), 'up') $$, 'guest votes without login');
select lives_ok($$ select public.cast_group_vote((select share_token from tok), 'guest-1', 'Asha', (select p1 from ids), 'down') $$, 'guest can change their vote');
select public.cast_group_vote((select share_token from tok), 'guest-2', 'Ravi', (select p1 from ids), 'up');
select is((select up from public.trip_vote_counts((select share_token from tok)) where entity_id = (select p1 from ids)), 1, 'vote counts: one up');
select is((select down from public.trip_vote_counts((select share_token from tok)) where entity_id = (select p1 from ids)), 1, 'vote counts: one down (changed vote)');
select throws_ok($$ select public.cast_group_vote('0000', 'g', 'x', (select p1 from ids), 'up') $$, '42501', null, 'bad token refused');
select is((select count(*)::int from public.group_votes), 0, 'guests cannot read voter names');
select pg_temp.login('00000000-0000-0000-0007-0000000000a1');
select is((select count(*)::int from public.group_votes where trip_id = (select trip from ids)), 2, 'owner sees each voter');

-- ------------------------------------------------ published routes
select pg_temp.login('00000000-0000-0000-0007-0000000000a2');
select throws_ok($$ insert into public.published_routes (trip_id) values ((select trip from ids)) $$, '42501', null, 'cannot publish someone else''s trip');
select pg_temp.login('00000000-0000-0000-0007-0000000000a1');
insert into public.published_routes (trip_id) select trip from ids;
update public.published_routes set status = 'approved' where trip_id = (select trip from ids);
select is((select status from public.published_routes where trip_id = (select trip from ids)), 'pending_review', 'owner cannot self-approve');
select pg_temp.login('00000000-0000-0000-0007-0000000000a2');
select is(public.get_route_for_review((select trip from ids)), null, 'non-reviewer cannot read a pending route');
select pg_temp.login('00000000-0000-0000-0007-0000000000b1');
select ok((public.get_route_for_review((select trip from ids)) -> 'trip' ->> 'title') = 'P7 trip', 'reviewer reads the pending route');
update public.published_routes set status = 'approved', reviewed_by = '00000000-0000-0000-0007-0000000000b1' where trip_id = (select trip from ids);
select pg_temp.anon();
select is((select title from public.trips where id = (select trip from ids)), 'P7 trip', 'approved route is public');
select is((select count(*)::int from public.trip_stops where trip_id = (select trip from ids)), 1, 'approved route stops are public');
update public.trips set title = 'x' where id = (select trip from ids);
select is((select title from public.trips where id = (select trip from ids)), 'P7 trip', 'public still cannot edit');

-- ------------------------------------------------ planner helpers
select is(jsonb_array_length(public.planner_matrix(array[(select p1 from ids), (select p2 from ids)])), 1, 'matrix pairs among given ids');
select is((public.planner_matrix(array[(select p1 from ids), (select p2 from ids)]) -> 0 ->> 2)::int, 720, 'corrected duration returned');
select is((select minutes from public.category_visit_minutes where category = 'fort'), 120::smallint, 'category default visit minutes');
select pg_temp.root();
insert into public.alerts (type, geometry, severity, source, expires_at)
values ('landslide', 'SRID=4326;POINT(73.3005 17)', 'danger', 'verifier', now() + interval '1 day');
select pg_temp.anon();
select is((select array_agg(x) from public.planner_alerted_places(array[(select p1 from ids), (select p2 from ids)]) x), array[(select p1 from ids)], 'danger alert within 1 km blocks only that place');

select * from finish();
rollback;
