-- Discover (T-24): each region can name a default weather point; map_search covers dishes, at most 5 per kind.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select has_column('public', 'regions', 'default_weather_point_id', 'regions name a default weather point');
select fk_ok('public', 'regions', 'default_weather_point_id', 'public', 'weather_points', 'id');
select has_index('public', 'regions', 'regions_default_weather_point_id_idx', array['default_weather_point_id']);

-- Fixtures: 7 published places and 2 dishes whose names share a unique token.
insert into public.places (slug, category, location, status, taluka_id)
select 'zq-place-' || i, 'beach', 'POINT(73.3 17.0)', 'published', (select id from public.talukas limit 1)
  from generate_series(1, 7) i;
insert into public.place_translations (place_id, lang, name)
select id, 'en', 'Zqxtoken place ' || slug from public.places where slug like 'zq-place-%';
insert into public.dishes (slug) values ('zq-dish-1'), ('zq-dish-2');
insert into public.dish_translations (dish_id, lang, name)
select id, 'en', 'Zqxtoken dish ' || slug from public.dishes where slug like 'zq-dish-%';

set local role anon;
select is((select count(*)::int from public.map_search('zqxtoken') where kind = 'place'), 5, 'places capped at 5');
select is((select count(*)::int from public.map_search('zqxtoken') where kind = 'dish'), 2, 'anon finds dishes');
select ok(
  (select bool_and(lon is null and lat is null) from public.map_search('zqxtoken') where kind = 'dish'),
  'dishes have no coordinates'
);
select is((select kind from public.map_search('zqxtoken') limit 1), 'place', 'places come first');
select is((select count(*)::int from public.map_search('z')), 0, 'one letter returns nothing');
reset role;

select * from finish();
rollback;
