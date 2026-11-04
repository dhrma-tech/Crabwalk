-- P12: the push queue (team answers, stay requests and replies, one year ago) and "seen" for team answers.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.login(_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', _uid, 'role', 'authenticated')::text, true);
end;
$$;
create function pg_temp.su() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
end;
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0012-0000000001a1', 'p12q-user@test.local'),
  ('00000000-0000-0000-0012-0000000001a3', 'p12q-verifier@test.local'),
  ('00000000-0000-0000-0012-0000000001a4', 'p12q-owner@test.local');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0012-0000000001a3', 'verifier');
create temp table fx as select (select id from public.stays where status = 'published' order by slug limit 1) stay;
update public.stays set owner_id = '00000000-0000-0000-0012-0000000001a4' where id = (select stay from fx);
grant select on fx to authenticated;
create function pg_temp.queued(_user uuid, _kind text) returns int language sql as $$
  select count(*)::int from public.push_queue where user_id = _user and kind = _kind;
$$;

select pg_temp.login('00000000-0000-0000-0012-0000000001a1');
insert into public.team_questions (question) values ('Is the Ganpatipule beach road open after the rains?');
select throws_ok($$ select * from public.push_queue $$, '42501', null, 'nobody reads the queue through the API');
select pg_temp.login('00000000-0000-0000-0012-0000000001a3');
update public.team_questions set status = 'answered', answer = 'Open, one lane near the bridge.', answered_at = now();
select pg_temp.su();
select is(pg_temp.queued('00000000-0000-0000-0012-0000000001a1', 'team_answer'), 1, 'asker is notified of the answer');

select pg_temp.login('00000000-0000-0000-0012-0000000001a1');
select is((select count(*)::int from public.match_team_answers('ganpatipule beach road open?')), 1,
  'a reworded question finds the answer');
select public.mark_team_answers_seen();
select isnt((select seen_at from public.team_questions), null, 'shown answers are marked seen');

insert into public.stay_requests (entity_type, entity_id, check_in, guests)
  values ('stay', (select stay from fx), current_date + 5, 3);
select pg_temp.su();
select is(pg_temp.queued('00000000-0000-0000-0012-0000000001a4', 'stay_request'), 1, 'claimed owner is notified');
select is((select params ->> 'guests' from public.push_queue where kind = 'stay_request'), '3', 'with the guest count only');
select pg_temp.login('00000000-0000-0000-0012-0000000001a4');
update public.stay_requests set status = 'available', owner_price = 2200;
select pg_temp.su();
select is(pg_temp.queued('00000000-0000-0000-0012-0000000001a1', 'stay_reply'), 1, 'traveller is notified of the reply');

insert into public.trips (owner_id, title, days, start_date)
  values ('00000000-0000-0000-0012-0000000001a1', 'Monsoon weekend', 2,
          ((now() at time zone 'Asia/Kolkata')::date - interval '1 year')::date - 1);
select app.queue_year_ago();
select is(pg_temp.queued('00000000-0000-0000-0012-0000000001a1', 'year_ago'), 1, 'one year after the last day');
select matches((select url from public.push_queue where kind = 'year_ago'), '^/plan/[0-9a-f-]+/journal$',
  'the nudge opens the journal');

select * from finish();
rollback;
