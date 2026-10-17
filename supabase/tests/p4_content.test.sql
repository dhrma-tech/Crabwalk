-- P4: owner fact edits never touch rating tables; media paths; approval workflow; re-check queue; owner claims.
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
  ('00000000-0000-0000-0000-0000000004a1', 'p4-user@test.local'),
  ('00000000-0000-0000-0000-0000000004b1', 'p4-verifier@test.local'),
  ('00000000-0000-0000-0000-0000000004c1', 'p4-reviewer@test.local'),
  ('00000000-0000-0000-0000-0000000004d1', 'p4-owner@test.local'),
  ('00000000-0000-0000-0000-0000000004e1', 'p4-admin@test.local');

create temp table ids as
select (select id from public.talukas where name_en = 'Ratnagiri') t, gen_random_uuid() eat, gen_random_uuid() stay,
       gen_random_uuid() place, gen_random_uuid() claim;
grant select on ids to anon, authenticated;

insert into public.eateries (id, slug, taluka_id, location, price_for_two, status)
select eat, 'p4-eatery', t, 'SRID=4326;POINT(73.30 16.98)', 500, 'published' from ids;
insert into public.stays (id, slug, taluka_id, location, price_min, price_max, status)
select stay, 'p4-stay', t, 'SRID=4326;POINT(73.31 16.98)', 1000, 2000, 'published' from ids;
insert into public.places (id, slug, category, taluka_id, location, status)
select place, 'p4-place', 'beach', t, 'SRID=4326;POINT(73.27 16.99)', 'draft' from ids;
insert into public.user_roles (user_id, role, taluka_id) select '00000000-0000-0000-0000-0000000004b1', 'verifier', t from ids;
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000004c1', 'reviewer');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000004e1', 'admin');
insert into public.user_roles (user_id, role, entity_type, entity_id) select '00000000-0000-0000-0000-0000000004d1', 'owner', 'eatery', eat from ids;

-- Ratings by a normal user on the owner's listing, and the aggregate.
insert into public.verdicts (user_id, entity_type, entity_id, group_type, level)
select '00000000-0000-0000-0000-0000000004a1', 'eatery', eat, 'family', 2 from ids;
insert into public.sub_scores (user_id, entity_type, entity_id, dimension, score)
select '00000000-0000-0000-0000-0000000004a1', 'eatery', eat, 'taste', 2 from ids;
insert into public.reviews (user_id, entity_type, entity_id, group_type, text, moderation_status)
select '00000000-0000-0000-0000-0000000004a1', 'eatery', eat, 'family', 'meh', 'approved' from ids;
create temp table rating_before as
select (select jsonb_agg(v order by id) from public.verdicts v) v, (select jsonb_agg(s order by id) from public.sub_scores s) s,
       (select jsonb_agg(r order by id) from public.reviews r) r, (select jsonb_agg(a) from public.verdict_agg a) a;

-- ---------------------------------------------------------------- owner: facts yes, ratings never
select pg_temp.login('00000000-0000-0000-0000-0000000004d1');
with u as (update public.eateries set price_for_two = 700, phone = '+910000000000', whatsapp = '+910000000000',
  menu = '{"items":["solkadhi"]}' where id = (select eat from ids) returning 1)
select is(count(*)::int, 1, 'owner edits price, menu and contact on own eatery') from u;
select throws_ok($$ update public.eateries set is_verified = true where id = (select eat from ids) $$,
  '42501', null, 'owner cannot set is_verified');
select lives_ok($$ insert into public.eatery_hours (eatery_id, weekday, opens, closes) select eat, 1, '09:00', '22:00' from ids $$,
  'owner edits timings');
with u as (update public.verdicts set level = 4 where entity_id = (select eat from ids) returning 1)
select is(count(*)::int, 0, 'owner cannot change others'' verdicts on own listing') from u;
with u as (update public.sub_scores set score = 5 where entity_id = (select eat from ids) returning 1)
select is(count(*)::int, 0, 'owner cannot change sub_scores') from u;
with u as (update public.reviews set moderation_status = 'rejected' where entity_id = (select eat from ids) returning 1)
select is(count(*)::int, 0, 'owner cannot moderate reviews') from u;
with d as (delete from public.reviews where entity_id = (select eat from ids) returning 1)
select is(count(*)::int, 0, 'owner cannot delete reviews') from d;
with u as (update public.verdict_agg set winner_level = 4 where entity_id = (select eat from ids) returning 1)
select is(count(*)::int, 0, 'owner cannot touch verdict_agg') from u;
select ok(app.can_write_media('eatery/' || (select eat from ids) || '/a.webp'), 'owner may upload photos for own eatery');
select ok(not app.can_write_media('stay/' || (select stay from ids) || '/a.webp'), 'owner may not upload for another listing');
select ok(not app.can_write_media('../etc/passwd'), 'media path must be <type>/<uuid>/<file>');

select pg_temp.root();
select is((select jsonb_agg(v order by id) from public.verdicts v), (select v from rating_before), 'verdicts unchanged after owner edits');
select is((select jsonb_agg(s order by id) from public.sub_scores s), (select s from rating_before), 'sub_scores unchanged');
select is((select jsonb_agg(r order by id) from public.reviews r), (select r from rating_before), 'reviews unchanged');
select is((select jsonb_agg(a) from public.verdict_agg a), (select a from rating_before), 'verdict_agg unchanged');

-- ---------------------------------------------------------------- approval workflow
select pg_temp.login('00000000-0000-0000-0000-0000000004b1');
select lives_ok($$ insert into public.content_drafts (entity_type, entity_id, lang, field, draft_text)
  select 'place', place, 'en', 'name', 'P4 Beach' from ids $$, 'verifier can queue a draft for own taluka');
select throws_ok($$ select public.approve_listing('place', (select place from ids)) $$, '42501', null,
  'verifier cannot approve/publish');

select pg_temp.login('00000000-0000-0000-0000-0000000004c1');
insert into public.content_drafts (entity_type, entity_id, lang, field, draft_text)
select 'place', place, 'mr', 'name', 'पी४ किनारा' from ids;
insert into public.content_drafts (entity_type, entity_id, lang, field, draft_text)
select 'place', place, 'en', 'short_story', 'A quiet cove.' from ids;
select lives_ok($$ select public.approve_listing('place', (select place from ids)) $$, 'reviewer approves');
select is((select status::text from public.places where id = (select place from ids)), 'published', 'place published');
select is((select name from public.place_translations where place_id = (select place from ids) and lang = 'mr'), 'पी४ किनारा', 'MR name copied');
select is((select short_story from public.place_translations where place_id = (select place from ids) and lang = 'en'), 'A quiet cove.', 'EN story copied');
select is((select count(*)::int from public.content_drafts where entity_id = (select place from ids) and status = 'draft'), 0, 'drafts marked approved');
select ok((select next_recheck_at > now() + interval '27 days' from public.places where id = (select place from ids)), 'publish schedules a monthly re-check');

select pg_temp.anon();
select is((select count(*)::int from public.places where id = (select place from ids)), 1, 'published place visible to anon');
select lives_ok($$ insert into public.reports (entity_type, entity_id, type, text) select 'place', place, 'wrong_info', 'closed now' from ids $$,
  'anon can report a problem');
select pg_temp.root();
select ok((select next_recheck_at <= now() from public.places where id = (select place from ids)), 'report pulls the re-check forward');

-- ---------------------------------------------------------------- owner claims (G5)
insert into public.owner_claims (id, user_id, entity_type, entity_id, email)
select claim, '00000000-0000-0000-0000-0000000004a1', 'stay', stay, 'p4-user@test.local' from ids;
select pg_temp.login('00000000-0000-0000-0000-0000000004c1');
select throws_ok($$ select public.review_owner_claim((select claim from ids), true) $$, '42501', null, 'reviewer cannot approve claims');
select pg_temp.login('00000000-0000-0000-0000-0000000004e1');
select lives_ok($$ select public.review_owner_claim((select claim from ids), true) $$, 'admin approves claim');
select pg_temp.root();
select ok(exists (select 1 from public.user_roles where user_id = '00000000-0000-0000-0000-0000000004a1' and role = 'owner'
  and entity_type = 'stay' and entity_id = (select stay from ids)), 'approval grants owner role for that listing only');
select is((select owner_id from public.stays where id = (select stay from ids)), '00000000-0000-0000-0000-0000000004a1'::uuid, 'stay owner set');

select * from finish();
rollback;
