-- DEV-ONLY seed. Every row is fake and flagged is_seed = true. Never load in production.
do $$
declare
  t uuid := (select id from public.talukas where name_en = 'Ratnagiri');
begin
  insert into public.places (slug, category, taluka_id, location, status, is_seed) values
    ('seed-beach-1', 'beach', t, 'SRID=4326;POINT(73.27 16.99)', 'published', true),
    ('seed-fort-1', 'fort', t, 'SRID=4326;POINT(73.28 17.00)', 'published', true),
    ('seed-temple-1', 'temple', t, 'SRID=4326;POINT(73.31 16.98)', 'published', true),
    ('seed-waterfall-1', 'waterfall', t, 'SRID=4326;POINT(73.35 17.02)', 'published', true),
    ('seed-viewpoint-1', 'viewpoint', t, 'SRID=4326;POINT(73.29 17.03)', 'draft', true);

  insert into public.place_translations (place_id, lang, name, short_story, is_seed)
  select id, 'en', initcap(replace(slug, '-', ' ')), 'Seed data for development.', true
  from public.places where is_seed;

  insert into public.stays (slug, taluka_id, location, service_style, price_min, price_max, price_source, status, is_seed) values
    ('seed-stay-1', t, 'SRID=4326;POINT(73.30 16.99)', 'homely', 1500, 2500, 'owner', 'published', true),
    ('seed-stay-2', t, 'SRID=4326;POINT(73.31 17.00)', 'professional', 3000, 5000, 'owner', 'published', true),
    ('seed-stay-3', t, 'SRID=4326;POINT(73.32 17.01)', 'homely', 1200, 1800, 'owner', 'draft', true);

  insert into public.stay_translations (stay_id, lang, name, is_seed)
  select id, 'en', initcap(replace(slug, '-', ' ')), true from public.stays where is_seed;

  insert into public.eateries (slug, taluka_id, location, authenticity, price_for_two, status, is_seed) values
    ('seed-eatery-1', t, 'SRID=4326;POINT(73.30 16.98)', 'home_style', 400, 'published', true),
    ('seed-eatery-2', t, 'SRID=4326;POINT(73.31 16.97)', 'local_legend', 600, 'published', true),
    ('seed-eatery-3', t, 'SRID=4326;POINT(73.29 16.96)', 'tourist_oriented', 900, 'draft', true);

  insert into public.eatery_translations (eatery_id, lang, name, is_seed)
  select id, 'en', initcap(replace(slug, '-', ' ')), true from public.eateries where is_seed;

  insert into public.dishes (slug, is_seed) values
    ('seed-dish-1', true), ('seed-dish-2', true), ('seed-dish-3', true);

  insert into public.dish_translations (dish_id, lang, name, is_seed)
  select id, 'en', initcap(replace(slug, '-', ' ')), true from public.dishes where is_seed;
end;
$$;
