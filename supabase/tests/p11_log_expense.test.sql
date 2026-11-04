-- P11 step E: log_trip_expense writes a spend and its shares together; RLS decides who may.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.login(_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', _uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0011-0000000000b1', 'p11e-owner@test.local'),
  ('00000000-0000-0000-0011-0000000000b2', 'p11e-viewer@test.local');
create temp table ids as select gen_random_uuid() trip;
grant select on ids to authenticated;

select pg_temp.login('00000000-0000-0000-0011-0000000000b1');
insert into public.trips (id, owner_id, title, days) select trip, '00000000-0000-0000-0011-0000000000b1', 'P11e', 1 from ids;
insert into public.trip_members (trip_id, display_name) select trip, 'Ravi' from ids;
insert into public.trip_invites (trip_id, role, token) select trip, 'viewer', 'p11e-view' from ids;
create temp table m as
select (select id from public.trip_members where user_id = '00000000-0000-0000-0011-0000000000b1') owner,
       (select id from public.trip_members where display_name = 'Ravi') ravi;
grant select on m to authenticated;

select lives_ok($$
  select public.log_trip_expense((select trip from ids), 900, 'food', ' Lunch ', (select owner from m), null, null, false,
    jsonb_build_array(jsonb_build_object('member_id', (select owner from m), 'amount', 450),
                      jsonb_build_object('member_id', (select ravi from m), 'amount', 450)))
$$, 'owner logs a spend with its shares');
select lives_ok($$ set constraints all immediate $$, 'shares add up at commit');
select is((select label from public.trip_expenses where trip_id = (select trip from ids)), 'Lunch', 'label is trimmed');
select is((select count(*)::int from public.trip_expense_shares where trip_id = (select trip from ids)), 2, 'two shares written');

-- Back to deferred (the check above left them immediate for the rest of the transaction).
set constraints all deferred;
select public.log_trip_expense((select trip from ids), 100, 'other', '', (select owner from m), null, null, true,
  jsonb_build_array(jsonb_build_object('member_id', (select ravi from m), 'amount', 60)));
select throws_ok($$ set constraints all immediate $$, '23514', 'expense shares must add up to the amount',
  'shares that do not add up are refused');

-- A viewer can't log spends (RLS).
select pg_temp.login('00000000-0000-0000-0011-0000000000b2');
select public.redeem_trip_invite('p11e-view');
select throws_ok($$
  select public.log_trip_expense((select trip from ids), 100, 'other', null,
    (select id from public.trip_members where trip_id = (select trip from ids) and role = 'owner'), null, null, false,
    jsonb_build_array(jsonb_build_object('member_id',
      (select id from public.trip_members where trip_id = (select trip from ids) and role = 'owner'), 'amount', 100)))
$$, '42501', null, 'a viewer cannot log spends');
select * from finish();
rollback;
