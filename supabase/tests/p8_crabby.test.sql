-- P8: 20/day cap (21st refused), action previews own-only + one-way status, AI review flags only by
-- reviewers, place similarity excludes the place itself.
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
  ('00000000-0000-0000-0008-0000000000a1', 'p8a@test.local'),
  ('00000000-0000-0000-0008-0000000000a2', 'p8b@test.local'),
  ('00000000-0000-0000-0008-0000000000b1', 'p8rev@test.local');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0008-0000000000b1', 'reviewer');

-- ------------------------------------------------ daily cap
select pg_temp.anon();
select throws_ok($$ select public.ai_take_message() $$, '42501', null, 'anon cannot use Crabby');
select pg_temp.login('00000000-0000-0000-0008-0000000000a1');
select is(public.ai_take_message(), 19, 'first message leaves 19');
do $$ begin for i in 2..20 loop perform public.ai_take_message(); end loop; end $$;
select pass('messages 2–20 accepted');
select throws_ok($$ select public.ai_take_message() $$, 'CW429', null, '21st message in a day is refused');
select is((select message_count from public.ai_usage where user_id = '00000000-0000-0000-0008-0000000000a1'), 20, 'count stops at the cap');
select pg_temp.login('00000000-0000-0000-0008-0000000000a2');
select is(public.ai_take_message(), 19, 'cap is per user');
select pg_temp.root();
update public.ai_usage set date = date - 1 where user_id = '00000000-0000-0000-0008-0000000000a1';
select pg_temp.login('00000000-0000-0000-0008-0000000000a1');
select is(public.ai_take_message(), 19, 'new IST day resets the count');

-- ------------------------------------------------ action previews
select pg_temp.login('00000000-0000-0000-0008-0000000000a1');
create temp table act as select gen_random_uuid() id;
grant select on act to authenticated;
insert into public.ai_actions (id, user_id, type, preview) select id, '00000000-0000-0000-0008-0000000000a1', 'open_map', '{}' from act;
select throws_ok($$ insert into public.ai_actions (user_id, type, preview, status) values ('00000000-0000-0000-0008-0000000000a1', 'open_map', '{}', 'applied') $$, '42501', null, 'cannot insert an already-applied action');
select throws_ok($$ insert into public.ai_actions (user_id, type, preview) values ('00000000-0000-0000-0008-0000000000a2', 'open_map', '{}') $$, '42501', null, 'cannot propose for another user');
select pg_temp.login('00000000-0000-0000-0008-0000000000a2');
select is((select count(*)::int from public.ai_actions where id = (select id from act)), 0, 'others cannot see my previews');
update public.ai_actions set status = 'discarded' where id = (select id from act);
select pg_temp.login('00000000-0000-0000-0008-0000000000a1');
select is((select status::text from public.ai_actions where id = (select id from act)), 'proposed', 'others cannot decide my previews');
update public.ai_actions set status = 'applied' where id = (select id from act);
select is((select status::text from public.ai_actions where id = (select id from act)), 'applied', 'owner applies');
update public.ai_actions set status = 'discarded' where id = (select id from act);
select is((select status::text from public.ai_actions where id = (select id from act)), 'applied', 'a decision is final');

-- ------------------------------------------------ review AI flags
select pg_temp.root();
create temp table ids as select (select id from public.talukas where name_en = 'Ratnagiri') t, gen_random_uuid() p1, gen_random_uuid() p2, gen_random_uuid() rv;
grant select on ids to authenticated, anon;
insert into public.places (id, slug, category, taluka_id, location, status) select p1, 'p8-a', 'fort', t, 'SRID=4326;POINT(73.3 17)', 'published' from ids;
insert into public.places (id, slug, category, taluka_id, location, status) select p2, 'p8-b', 'fort', t, 'SRID=4326;POINT(73.31 17)', 'published' from ids;
select pg_temp.login('00000000-0000-0000-0008-0000000000a2');
insert into public.reviews (id, user_id, entity_type, entity_id, group_type, text, ai_flag, ai_reason)
select rv, '00000000-0000-0000-0008-0000000000a2', 'place', p1, 'family', 'Lovely fort', 'ok', 'self-approved' from ids;
select is((select ai_flag from public.reviews where id = (select rv from ids)), null, 'author cannot set an AI flag');
select pg_temp.login('00000000-0000-0000-0008-0000000000b1');
update public.reviews set ai_flag = 'flagged', ai_reason = 'test' where id = (select rv from ids);
select is((select ai_flag from public.reviews where id = (select rv from ids)), 'flagged', 'reviewer sets the AI flag');
select pg_temp.root();
update public.reviews set moderation_status = moderation_status where id = (select rv from ids);
select is((select ai_flag from public.reviews where id = (select rv from ids)), 'flagged', 'flag kept when the text is unchanged');
update public.reviews set text = 'Edited text' where id = (select rv from ids);
select is((select ai_flag from public.reviews where id = (select rv from ids)), null, 'edited text clears the flag for a fresh check');

-- ------------------------------------------------ similarity
insert into public.place_embeddings (place_id, embedding)
select p1, array_fill(0.1::real, array[384])::extensions.vector from ids union all
select p2, array_fill(0.1::real, array[384])::extensions.vector from ids;
select pg_temp.anon();
select ok(not exists (select 1 from public.similar_places('p8-a', 10) where slug = 'p8-a'), 'a place is never similar to itself');
select ok(exists (select 1 from public.similar_places('p8-a', 10) where slug = 'p8-b'), 'similar place found');

select * from finish();
rollback;
