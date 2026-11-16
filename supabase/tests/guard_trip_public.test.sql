-- SEC-01: owners cannot make their own trip "official" (is_ready_made / slug / owner_id); staff and service can.
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

insert into auth.users (id, email) values
  ('00000000-0000-0000-0112-0000000000a1', 'gtp-user@test.local'),
  ('00000000-0000-0000-0112-0000000000a2', 'gtp-other@test.local'),
  ('00000000-0000-0000-0112-0000000000b1', 'gtp-admin@test.local'),
  ('00000000-0000-0000-0112-0000000000b2', 'gtp-reviewer@test.local');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0112-0000000000b1', 'admin'),
  ('00000000-0000-0000-0112-0000000000b2', 'reviewer');

select pg_temp.login('00000000-0000-0000-0112-0000000000a1');
select lives_ok($$ insert into public.trips (id, owner_id, title, days)
  values ('00000000-0000-0000-0112-00000000cc01', '00000000-0000-0000-0112-0000000000a1', 'Mine', 2) $$,
  'a user creates an ordinary trip');
select throws_ok($$ insert into public.trips (owner_id, title, days, is_ready_made)
  values ('00000000-0000-0000-0112-0000000000a1', 'Official', 2, true) $$, '42501', null, 'cannot insert a ready-made trip');
select throws_ok($$ insert into public.trips (owner_id, title, days, slug)
  values ('00000000-0000-0000-0112-0000000000a1', 'Official', 2, 'official-plan') $$, '42501', null, 'cannot insert a trip with a slug');
select throws_ok($$ update public.trips set is_ready_made = true where id = '00000000-0000-0000-0112-00000000cc01' $$,
  '42501', null, 'owner cannot set is_ready_made');
select throws_ok($$ update public.trips set slug = 'official-3-day-plan' where id = '00000000-0000-0000-0112-00000000cc01' $$,
  '42501', null, 'owner cannot set a slug');
select throws_ok($$ update public.trips set owner_id = '00000000-0000-0000-0112-0000000000a2' where id = '00000000-0000-0000-0112-00000000cc01' $$,
  '42501', null, 'owner cannot hand the trip to someone else');
select lives_ok($$ update public.trips set title = 'Renamed', days = 3 where id = '00000000-0000-0000-0112-00000000cc01' $$,
  'ordinary edits still work');

-- Service role / seeds (no auth.uid()) and staff are unaffected.
select pg_temp.root();
select lives_ok($$ update public.trips set is_ready_made = true, slug = 'gtp-seed' where id = '00000000-0000-0000-0112-00000000cc01' $$,
  'service role / seeds can publish');
update public.trips set is_ready_made = false, slug = null where id = '00000000-0000-0000-0112-00000000cc01';
-- Staff: RLS decides which rows they reach; the trigger itself lets them through (own trips here).
select pg_temp.login('00000000-0000-0000-0112-0000000000b1');
select lives_ok($$ insert into public.trips (id, owner_id, title, days, is_ready_made, slug)
  values ('00000000-0000-0000-0112-00000000cc02', '00000000-0000-0000-0112-0000000000b1', 'Team plan', 2, true, 'gtp-team-plan') $$,
  'admin can create a ready-made trip');
select pg_temp.login('00000000-0000-0000-0112-0000000000b2');
select lives_ok($$ insert into public.trips (id, owner_id, title, days, slug)
  values ('00000000-0000-0000-0112-00000000cc03', '00000000-0000-0000-0112-0000000000b2', 'Reviewed', 2, 'gtp-reviewed') $$,
  'reviewer can set a slug');

select * from finish();
rollback;
