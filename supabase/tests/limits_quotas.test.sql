-- SEC-05: size limits, per-user quotas, storage quotas and the checked report path hold in SQL.
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
  ('00000000-0000-0000-0114-0000000000a1', 'lq-user@test.local'),
  ('00000000-0000-0000-0114-0000000000a2', 'lq-other@test.local');
create temp table ids as
select (select id from public.talukas where name_en = 'Ratnagiri') t, gen_random_uuid() place;
grant select on ids to authenticated, anon;
insert into public.places (id, slug, category, taluka_id, location, status)
select place, 'lq-place', 'beach', t, 'SRID=4326;POINT(82.05 22.05)', 'published' from ids;

-- ------------------------------------------------ reports: RPC only
select pg_temp.anon();
select throws_ok($$ insert into public.reports (entity_type, entity_id, type) select 'place', place, 'broken_qr' from ids $$,
  '42501', null, 'anon cannot insert reports directly');
select throws_ok($$ select public.file_report('place', (select place from ids), 'garbage', 'x') $$, '42501', null, 'anon cannot call file_report');
select pg_temp.login('00000000-0000-0000-0114-0000000000a1');
select throws_ok($$ insert into public.reports (entity_type, entity_id, type) select 'place', place, 'broken_qr' from ids $$,
  '42501', null, 'users cannot insert reports directly');
select throws_ok($$ select public.file_report('place', (select place from ids), 'garbage', 'x') $$, '42501', null, 'users cannot call file_report');
select pg_temp.root();
select lives_ok($$ select public.file_report('place', (select place from ids), 'garbage', '  litter by the steps  ') $$, 'the server files a report');
select is((select text from public.reports where entity_id = (select place from ids)), 'litter by the steps', 'text is trimmed');
select ok((select next_recheck_at <= now() from public.places where id = (select place from ids)), 'the re-check trigger still fires');
select throws_ok($$ select public.file_report('place', gen_random_uuid(), 'garbage', 'x') $$, 'P0002', null, 'unknown listing is refused');
select throws_ok($$ select public.file_report('place', (select place from ids), 'garbage', repeat('x', 1001)) $$, '22001', null, 'over-long text is refused');
-- Global cap: 200 an hour across all listings (random ids are not throttled per listing, so they are capped here).
insert into public.reports (entity_type, entity_id, type)
select 'stay', gen_random_uuid(), 'wrong_info' from generate_series(1, 199);
select throws_ok($$ select public.file_report('place', (select place from ids), 'garbage', 'x') $$, '54000', null, 'the 201st report in an hour is refused');
delete from public.reports;

-- ------------------------------------------------ text limits
select throws_ok($$ insert into public.reports (entity_type, entity_id, type, text) select 'place', place, 'garbage', repeat('x', 1001) from ids $$,
  '23514', null, 'reports.text is capped at 1000');
select pg_temp.login('00000000-0000-0000-0114-0000000000a1');
select throws_ok($$ insert into public.reviews (user_id, entity_type, entity_id, group_type, text)
  select '00000000-0000-0000-0114-0000000000a1', 'place', place, 'solo', repeat('x', 2001) from ids $$, '23514', null, 'a 2,001-character review is refused');
select lives_ok($$ insert into public.reviews (user_id, entity_type, entity_id, group_type, text)
  select '00000000-0000-0000-0114-0000000000a1', 'place', place, 'couple', repeat('x', 2000) from ids $$, '2,000 characters is fine');
select throws_ok($$ insert into public.trips (owner_id, title, days) values ('00000000-0000-0000-0114-0000000000a1', repeat('t', 121), 1) $$,
  '23514', null, 'trip title is capped at 120');
select throws_ok($$ insert into public.trips (owner_id, title, days) values ('00000000-0000-0000-0114-0000000000a1', '', 1) $$,
  '23514', null, 'trip title cannot be empty');
select throws_ok($$ update public.profiles set display_name = repeat('n', 81) where id = '00000000-0000-0000-0114-0000000000a1' $$,
  '23514', null, 'display name is capped at 80');
select throws_ok($$ insert into public.ai_actions (user_id, type, preview)
  select '00000000-0000-0000-0114-0000000000a1', 'open_map', jsonb_build_object('x', (select string_agg(md5(g::text), '') from generate_series(1, 2000) g)) $$,
  '23514', null, 'ai_actions.preview is capped at 16 KB');

-- ------------------------------------------------ row quotas
select pg_temp.root();
insert into public.trips (owner_id, title, days)
select '00000000-0000-0000-0114-0000000000a1', 'T' || g, 1 from generate_series(1, 100) g;
select pg_temp.login('00000000-0000-0000-0114-0000000000a1');
select throws_ok($$ insert into public.trips (owner_id, title, days) values ('00000000-0000-0000-0114-0000000000a1', 'one too many', 1) $$,
  'CW429', null, 'the 101st trip is refused');
select pg_temp.login('00000000-0000-0000-0114-0000000000a2');
select lives_ok($$ insert into public.trips (id, owner_id, title, days) values ('00000000-0000-0000-0114-00000000cc01', '00000000-0000-0000-0114-0000000000a2', 'mine', 1) $$,
  'other users are not affected');

select pg_temp.root();
insert into public.saved_items (user_id, entity_type, entity_id)
select '00000000-0000-0000-0114-0000000000a1', 'place', gen_random_uuid() from generate_series(1, 1000);
insert into public.ai_actions (user_id, type, preview)
select '00000000-0000-0000-0114-0000000000a1', 'open_map', '{}' from generate_series(1, 500);
insert into public.trip_stops (trip_id, day, "order", entity_type, entity_id, kind)
select '00000000-0000-0000-0114-00000000cc01', 1, g, 'place', (select place from ids), 'place' from generate_series(1, 300) g;
select pg_temp.login('00000000-0000-0000-0114-0000000000a1');
select throws_ok($$ insert into public.saved_items (entity_type, entity_id) values ('place', gen_random_uuid()) $$, 'CW429', null, 'the 1,001st save is refused');
select throws_ok($$ insert into public.ai_actions (user_id, type, preview) values ('00000000-0000-0000-0114-0000000000a1', 'open_map', '{}') $$,
  'CW429', null, 'the 501st action is refused');
select pg_temp.login('00000000-0000-0000-0114-0000000000a2');
select throws_ok($$ insert into public.trip_stops (trip_id, day, "order", entity_type, entity_id, kind)
  select '00000000-0000-0000-0114-00000000cc01', 1, 301, 'place', place, 'place' from ids $$, 'CW429', null, 'the 301st stop in a trip is refused');

-- ------------------------------------------------ storage quotas
select pg_temp.root();
insert into storage.objects (bucket_id, name, owner, metadata)
select 'review-photos', '00000000-0000-0000-0114-0000000000a1/' || g || '.webp', '00000000-0000-0000-0114-0000000000a1', '{"mimetype":"image/webp"}'
from generate_series(1, 200) g;
insert into storage.objects (bucket_id, name, owner, metadata)
select 'journal', '00000000-0000-0000-0114-0000000000a1/' || g || '.webp', '00000000-0000-0000-0114-0000000000a1', '{"mimetype":"image/webp"}'
from generate_series(1, 39) g;
select pg_temp.login('00000000-0000-0000-0114-0000000000a1');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner) values ('review-photos', '00000000-0000-0000-0114-0000000000a1/201.webp', '00000000-0000-0000-0114-0000000000a1') $$,
  '42501', null, 'the 201st review photo object is refused');
select lives_ok($$ insert into storage.objects (bucket_id, name, owner) values ('journal', '00000000-0000-0000-0114-0000000000a1/40.webp', '00000000-0000-0000-0114-0000000000a1') $$,
  'the 40th journal object is allowed');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner) values ('journal', '00000000-0000-0000-0114-0000000000a1/41.webp', '00000000-0000-0000-0114-0000000000a1') $$,
  '42501', null, 'the 41st journal object is refused');
select pg_temp.login('00000000-0000-0000-0114-0000000000a2');
select lives_ok($$ insert into storage.objects (bucket_id, name, owner) values ('review-photos', '00000000-0000-0000-0114-0000000000a2/1.webp', '00000000-0000-0000-0114-0000000000a2') $$,
  'another user''s folder is unaffected');

select * from finish();
rollback;
