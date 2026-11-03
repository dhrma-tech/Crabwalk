-- P11: tripmates and roles, invite links, email invites, the 20-tripmate cap, lists, expense shares.
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
  ('00000000-0000-0000-0011-0000000000a1', 'p11owner@test.local'),
  ('00000000-0000-0000-0011-0000000000a2', 'p11editor@test.local'),
  ('00000000-0000-0000-0011-0000000000a3', 'p11viewer@test.local'),
  ('00000000-0000-0000-0011-0000000000a4', 'p11outsider@test.local');

create temp table ids as
select (select id from public.talukas where name_en = 'Ratnagiri') t, gen_random_uuid() p1, gen_random_uuid() trip;
grant select on ids to authenticated;
insert into public.places (id, slug, category, taluka_id, location, status)
select p1, 'p11-a', 'fort', t, 'SRID=4326;POINT(73.3 17)', 'published' from ids;

select pg_temp.login('00000000-0000-0000-0011-0000000000a1');
insert into public.trips (id, owner_id, title, days)
select trip, '00000000-0000-0000-0011-0000000000a1', 'P11 trip', 2 from ids;

-- ------------------------------------------------ owner row
select is((select role::text from public.trip_members where trip_id = (select trip from ids)), 'owner',
  'creating a trip adds the owner as a tripmate');
select is((select display_name from public.trip_members where trip_id = (select trip from ids)), 'p11owner',
  'owner name falls back to the email local part');

-- ------------------------------------------------ invite links
insert into public.trip_invites (trip_id, role) select trip, 'editor' from ids;
insert into public.trip_invites (trip_id, role) select trip, 'viewer' from ids;
select pg_temp.root();
create temp table tok as
select (select token from public.trip_invites where role = 'editor' and trip_id = (select trip from ids)) edit,
       (select token from public.trip_invites where role = 'viewer' and trip_id = (select trip from ids)) view;
grant select on tok to authenticated;

select pg_temp.login('00000000-0000-0000-0011-0000000000a4');
select is((select count(*)::int from public.trips where id = (select trip from ids)), 0, 'outsider cannot read the trip');
select is((select count(*)::int from public.trip_members where trip_id = (select trip from ids)), 0, 'outsider cannot read tripmates');
select is((select count(*)::int from public.trip_invites), 0, 'outsider cannot read invite tokens');
select throws_ok($$ select public.redeem_trip_invite('nope') $$, '42501', 'invalid invite', 'a wrong token is refused');

select pg_temp.login('00000000-0000-0000-0011-0000000000a2');
select is(public.redeem_trip_invite((select edit from tok)), (select trip from ids), 'edit link joins the trip');
select pg_temp.login('00000000-0000-0000-0011-0000000000a3');
select is(public.redeem_trip_invite((select view from tok)), (select trip from ids), 'view link joins the trip');
select is((select count(*)::int from public.trip_members where trip_id = (select trip from ids)), 3, 'viewer sees all tripmates');

-- ------------------------------------------------ viewer reads, cannot write
select is((select title from public.trips where id = (select trip from ids)), 'P11 trip', 'viewer reads the trip');
select throws_ok($$ insert into public.trip_lists (trip_id, title) select trip, 'x' from ids $$, '42501', null,
  'viewer cannot add a list');
select throws_ok($$ insert into public.trip_stops (trip_id, day, "order", entity_type, entity_id, kind)
  select trip, 1, 0, 'place', p1, 'place' from ids $$, '42501', null, 'viewer cannot add a stop');

-- ------------------------------------------------ editor writes
select pg_temp.login('00000000-0000-0000-0011-0000000000a2');
insert into public.trip_stops (trip_id, day, "order", entity_type, entity_id, kind)
select trip, 1, 0, 'place', p1, 'place' from ids;
select is((select count(*)::int from public.trip_stops where trip_id = (select trip from ids)), 1, 'editor adds a stop');
insert into public.trip_lists (trip_id, title) select trip, 'Places to visit' from ids;
insert into public.trip_list_items (list_id, trip_id, kind, entity_type, entity_id)
select l.id, l.trip_id, 'place', 'place', ids.p1 from public.trip_lists l, ids where l.trip_id = ids.trip;
insert into public.trip_list_items (list_id, trip_id, kind, body)
select l.id, l.trip_id, 'check', 'Carry cash for the ferry' from public.trip_lists l, ids where l.trip_id = ids.trip;
select is((select count(*)::int from public.trip_list_items where trip_id = (select trip from ids)), 2, 'editor adds list items');
select throws_ok($$ insert into public.trip_list_items (list_id, trip_id, kind, body)
  select l.id, l.trip_id, 'place', 'x' from public.trip_lists l, ids where l.trip_id = ids.trip $$, '23514', null,
  'a place item needs a listing, not text');
update public.trips set title = 'Hijacked' where id = (select trip from ids);
select is((select title from public.trips where id = (select trip from ids)), 'P11 trip', 'editor cannot change trip settings');
insert into public.trip_members (trip_id, display_name) select trip, 'Asha' from ids;
select is((select count(*)::int from public.trip_members where trip_id = (select trip from ids) and user_id is null), 1,
  'editor adds a name-only tripmate');
select throws_ok($$ insert into public.trip_members (trip_id, user_id, display_name, role)
  select trip, '00000000-0000-0000-0011-0000000000a4', 'X', 'editor' from ids $$, '42501', null,
  'editor cannot add accounts');
update public.trip_members set role = 'editor' where user_id = '00000000-0000-0000-0011-0000000000a3';
select is((select role::text from public.trip_members where user_id = '00000000-0000-0000-0011-0000000000a3'), 'viewer',
  'editor cannot change roles');

-- ------------------------------------------------ expenses: shares must add up
create temp table m as
select (select id from public.trip_members where user_id = '00000000-0000-0000-0011-0000000000a1') owner,
       (select id from public.trip_members where user_id = '00000000-0000-0000-0011-0000000000a2') editor,
       (select id from public.trip_members where display_name = 'Asha') asha, gen_random_uuid() e1, gen_random_uuid() e2;
grant select on m to authenticated;

insert into public.trip_expenses (id, trip_id, amount, category, label, paid_by)
select m.e1, ids.trip, 1000, 'food', 'Thali', m.owner from m, ids;
insert into public.trip_expense_shares (expense_id, trip_id, member_id, amount)
select m.e1, ids.trip, x.member, x.amt from m, ids,
  lateral (values (m.owner, 334), (m.editor, 333), (m.asha, 333)) x(member, amt);
set constraints all immediate;
select pass('equal split that adds up commits');
set constraints all deferred;

insert into public.trip_expenses (id, trip_id, amount, category, paid_by, split_custom)
select m.e2, ids.trip, 500, 'fuel', m.asha, true from m, ids;
insert into public.trip_expense_shares (expense_id, trip_id, member_id, amount)
select m.e2, ids.trip, m.owner, 300 from m, ids;
select throws_ok($$ set constraints all immediate $$, '23514', 'expense shares must add up to the amount',
  'custom shares that do not add up are refused');
set constraints all deferred;
insert into public.trip_expense_shares (expense_id, trip_id, member_id, amount)
select m.e2, ids.trip, m.editor, 200 from m, ids;
set constraints all immediate;
select pass('custom split that adds up commits');
set constraints all deferred;

select pg_temp.login('00000000-0000-0000-0011-0000000000a3');
select is((select sum(amount)::int from public.trip_expenses where trip_id = (select trip from ids)), 1500, 'viewer reads spends');
delete from public.trip_expenses where id = (select e1 from m);
select is((select count(*)::int from public.trip_expenses where trip_id = (select trip from ids)), 2, 'viewer cannot delete spends');

-- ------------------------------------------------ email invites, owner protection, leaving
select pg_temp.login('00000000-0000-0000-0011-0000000000a2');
select throws_ok($$ select public.add_trip_member_by_email((select trip from ids), 'p11outsider@test.local', 'viewer') $$,
  '42501', null, 'only the owner invites by email');
select pg_temp.login('00000000-0000-0000-0011-0000000000a1');
select is(public.add_trip_member_by_email((select trip from ids), 'nobody@test.local', 'viewer'), false,
  'unknown address: false (page opens the mail app)');
select is(public.add_trip_member_by_email((select trip from ids), ' P11Outsider@test.local ', 'editor'), true,
  'known address is added straight away');
select is((select role::text from public.trip_members where user_id = '00000000-0000-0000-0011-0000000000a4'), 'editor',
  'emailed tripmate has the chosen role');
select throws_ok($$ delete from public.trip_members where user_id = '00000000-0000-0000-0011-0000000000a1' $$, '42501',
  'the owner stays on the trip', 'owner cannot be removed');

select pg_temp.login('00000000-0000-0000-0011-0000000000a3');
delete from public.trip_members where user_id = '00000000-0000-0000-0011-0000000000a3';
select is((select count(*)::int from public.trips where id = (select trip from ids)), 0, 'a tripmate can leave');

-- ------------------------------------------------ cap: 20 tripmates
select pg_temp.login('00000000-0000-0000-0011-0000000000a1');
insert into public.trip_members (trip_id, display_name)
select ids.trip, 'Friend ' || g from ids, generate_series(1, 20 - (select count(*) from public.trip_members where trip_id = ids.trip)::int) g;
select is((select count(*)::int from public.trip_members where trip_id = (select trip from ids)), 20, 'up to 20 tripmates');
select throws_ok($$ insert into public.trip_members (trip_id, display_name) select trip, 'One too many' from ids $$,
  '23514', 'a trip has at most 20 tripmates', 'the 21st tripmate is refused');

-- ------------------------------------------------ deleting the trip removes everything
delete from public.trips where id = (select trip from ids);
select pg_temp.root();
select is((select count(*)::int from public.trip_members where trip_id = (select trip from ids)), 0, 'trip delete cascades');

select * from finish();
rollback;
