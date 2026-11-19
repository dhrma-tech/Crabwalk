-- T2-04: find_places — published only, hard filters, crowd as a preference, matched / score, limit clamp.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

do $$
declare
  t uuid;
  g uuid := (select id from public.talukas where name_en = 'Guhagar');
begin
  -- A taluka of its own, so real local listings never crowd these rows out of the limit.
  insert into public.talukas (region_id, name_en, name_hi, name_mr)
  select region_id, 'FP Test', 'FP Test', 'FP Test' from public.talukas where name_en = 'Ratnagiri'
  returning id into t;
  insert into public.places (slug, category, taluka_id, location, status, is_hidden_gem, is_tide_dependent, monsoon_status) values
    ('fp-beach-calm', 'beach', t, 'SRID=4326;POINT(73.300 17.100)', 'published', false, false, 'open'),
    ('fp-beach-busy', 'beach', t, 'SRID=4326;POINT(73.305 17.105)', 'published', false, false, 'open'),
    ('fp-beach-tidal', 'beach', t, 'SRID=4326;POINT(73.310 17.110)', 'published', false, true, 'risky'),
    ('fp-cave-gem', 'cave', t, 'SRID=4326;POINT(73.330 17.120)', 'published', true, false, 'open'),
    ('fp-falls-closed', 'waterfall', t, 'SRID=4326;POINT(73.340 17.130)', 'published', true, false, 'closed'),
    ('fp-gem-far', 'viewpoint', g, 'SRID=4326;POINT(73.200 17.600)', 'published', true, false, 'open'),
    ('fp-beach-draft', 'beach', t, 'SRID=4326;POINT(73.301 17.101)', 'draft', false, false, 'open');
  insert into public.place_translations (place_id, lang, name)
  select id, 'en', initcap(replace(slug, '-', ' ')) from public.places where slug like 'fp-%';
  insert into public.crowd_typical (place_id, weekday, level)
  select id, 2, 'calm'::public.crowd_level from public.places where slug = 'fp-beach-calm'
  union all select id, 2, 'busy'::public.crowd_level from public.places where slug = 'fp-beach-busy';
end;
$$;

set local role anon;
select ok(has_function_privilege('anon', 'public.find_places(public.place_category[], text, boolean, text, text, numeric, boolean, boolean, smallint, integer)', 'execute'), 'anon may call it');

select is(
  (select array_agg(slug order by slug) from public.find_places(_categories => '{beach}', _taluka => 'FP Test', _limit => 8) where slug like 'fp-%'),
  array['fp-beach-busy', 'fp-beach-calm', 'fp-beach-tidal'],
  'category is a hard filter; drafts never appear');

select is(
  (select slug from public.find_places(_categories => '{beach}', _crowd => 'calm', _weekday => 2::smallint, _taluka => 'FP Test') limit 1),
  'fp-beach-calm', 'a calm beach ranks first (V1)');
select is(
  (select matched from public.find_places(_categories => '{beach}', _crowd => 'calm', _weekday => 2::smallint, _taluka => 'FP Test') where slug = 'fp-beach-calm'),
  array['category', 'crowd:calm'], 'matched names category and crowd');
select is(
  (select score from public.find_places(_categories => '{beach}', _crowd => 'calm', _weekday => 2::smallint, _taluka => 'FP Test') where slug = 'fp-beach-busy'),
  1, 'crowd is a preference: the busy beach stays, with a lower score');

select ok(
  not exists (select 1 from public.find_places(_monsoon_ok => true, _limit => 8) f
              join public.places p on p.slug = f.slug where p.monsoon_status <> 'open'),
  'monsoon_ok returns only monsoon-open places (V2)');
select ok(
  not exists (select 1 from public.find_places(_tide_free => true, _limit => 8) where slug = 'fp-beach-tidal'),
  'tide_free drops tide-dependent places');

select is(
  (select array_agg(slug order by slug) from public.find_places(_near_slug => 'fp-beach-calm', _max_km => 10, _hidden_gem => true) where slug like 'fp-%'),
  array['fp-cave-gem', 'fp-falls-closed'],
  'hidden gems within the radius only, not the origin (V3)');
select ok(
  (select bool_and(km <= 10 and matched @> array['near', 'hidden_gem'] and score = 2)
   from public.find_places(_near_slug => 'fp-beach-calm', _max_km => 10, _hidden_gem => true)),
  'each near hit carries km, near and hidden_gem');
select is(
  (select count(*)::int from public.find_places(_near_slug => 'no-such-place')), 0,
  'an unknown origin finds nothing');

select is((select count(*)::int from public.find_places(_limit => 50)), 8, 'limit is clamped to 8');
select is((select count(*)::int from public.find_places(_categories => '{beach}', _limit => 0)), 1, 'and to at least 1');

select * from finish();
rollback;
