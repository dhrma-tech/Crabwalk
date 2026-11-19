-- DEV-ONLY eval dataset for Crabby (hardening T2-07, AI Spec 5.7). Every row is fake, flagged is_seed and named
-- "Eval …" / slug "eval-…". Loaded by apps/web/scripts/ai-eval.ts into the LOCAL stack only; safe to re-run (it
-- deletes its own rows first). Never load in production. The checks in apps/web/src/lib/server/ai/evals/cases.ts
-- refer to these names and values (SEED there). The runner runs the first block again at the end, so the e2e
-- suites never see these rows.
-- @cleanup
do $$
begin
  delete from public.team_questions where question like 'Eval:%';
  delete from public.alerts where reason_en like 'Eval:%';
  delete from public.weather_cache where point_id in (select id from public.weather_points where name = 'Eval Point');
  delete from public.weather_points where name = 'Eval Point';
  update public.places set tide_station_id = null where tide_station_id in (select id from public.tide_stations where name = 'Eval Station');
  delete from public.tide_cache where station_id in (select id from public.tide_stations where name = 'Eval Station');
  delete from public.tide_stations where name = 'Eval Station';
  delete from public.eatery_dishes where dish_id in (select id from public.dishes where slug like 'eval-%');
  delete from public.dish_translations where dish_id in (select id from public.dishes where slug like 'eval-%');
  delete from public.dishes where slug like 'eval-%';
  delete from public.eatery_translations where eatery_id in (select id from public.eateries where slug like 'eval-%');
  delete from public.eateries where slug like 'eval-%';
  delete from public.stay_translations where stay_id in (select id from public.stays where slug like 'eval-%');
  delete from public.stays where slug like 'eval-%';
  delete from public.place_tide_rules where place_id in (select id from public.places where slug like 'eval-%');
  delete from public.crowd_typical where place_id in (select id from public.places where slug like 'eval-%');
  delete from public.place_hours where place_id in (select id from public.places where slug like 'eval-%');
  delete from public.place_translations where place_id in (select id from public.places where slug like 'eval-%');
  delete from public.places where slug like 'eval-%';
  delete from public.utility_pois where name = 'Ratnagiri Eval Station';
end;
$$;
-- @load
do $$
declare
  rtn uuid := (select id from public.talukas where name_en = 'Ratnagiri');
  ghg uuid := (select id from public.talukas where name_en = 'Guhagar');
  rjp uuid := (select id from public.talukas where name_en = 'Rajapur');
  st uuid;
  wp uuid;
  today date := (now() at time zone 'Asia/Kolkata')::date;
  d date;
begin
  insert into public.tide_stations (name, location, provider_station_id)
  values ('Eval Station', 'SRID=4326;POINT(73.275 17.035)', 'eval-station') returning id into st;

  -- 12 places in 3 talukas. Fort A: 09:30–17:30, ₹25. Temple B: no fee on record. The island needs the tide.
  insert into public.places (slug, category, taluka_id, location, status, is_seed, monsoon_status, monsoon_reason,
      is_hidden_gem, is_tide_dependent, tide_station_id, entry_fee_inr, entry_fee_text, visit_minutes) values
    ('eval-fort-a', 'fort', rtn, 'SRID=4326;POINT(73.300 17.050)', 'published', true, 'open', null, false, false, null, 25, '₹25 per person', 60),
    ('eval-temple-b', 'temple', rtn, 'SRID=4326;POINT(73.320 17.060)', 'published', true, 'open', null, false, false, null, null, null, 30),
    ('eval-tidal-island', 'beach', rtn, 'SRID=4326;POINT(73.280 17.040)', 'published', true, 'risky', 'Waves are high in the monsoon', false, true, st, null, null, 60),
    ('eval-beach-quiet', 'beach', ghg, 'SRID=4326;POINT(73.190 17.480)', 'published', true, 'open', null, false, false, null, null, null, 90),
    ('eval-beach-busy', 'beach', ghg, 'SRID=4326;POINT(73.195 17.490)', 'published', true, 'open', null, false, false, null, null, null, 90),
    ('eval-falls-closed', 'waterfall', rjp, 'SRID=4326;POINT(73.520 16.650)', 'published', true, 'closed', 'Slippery rocks in the monsoon', false, false, null, null, null, 60),
    ('eval-cave-gem', 'cave', rtn, 'SRID=4326;POINT(73.330 17.070)', 'published', true, 'open', null, true, false, null, null, null, 45),
    ('eval-viewpoint-gem', 'viewpoint', rtn, 'SRID=4326;POINT(73.360 17.090)', 'published', true, 'open', null, true, false, null, null, null, 30),
    ('eval-far-gem', 'viewpoint', rjp, 'SRID=4326;POINT(73.540 16.600)', 'published', true, 'open', null, true, false, null, null, null, 30),
    ('eval-museum-rain', 'museum', rtn, 'SRID=4326;POINT(73.310 17.040)', 'published', true, 'open', null, false, false, null, 20, '₹20', 60),
    ('eval-fort-alert', 'fort', ghg, 'SRID=4326;POINT(73.200 17.500)', 'published', true, 'open', null, false, false, null, null, null, 60),
    ('eval-backwater', 'backwater', rjp, 'SRID=4326;POINT(73.500 16.680)', 'published', true, 'risky', 'Boats stop in heavy rain', false, false, null, null, null, 60);

  insert into public.place_translations (place_id, lang, name, short_story, is_seed)
  select id, 'en', v.name, 'Eval data for Crabby checks.', true
  from public.places p join (values
    ('eval-fort-a', 'Eval Fort A'), ('eval-temple-b', 'Eval Temple B'), ('eval-tidal-island', 'Eval Tidal Island'),
    ('eval-beach-quiet', 'Eval Quiet Beach'), ('eval-beach-busy', 'Eval Busy Beach'),
    ('eval-falls-closed', 'Eval Closed Falls'), ('eval-cave-gem', 'Eval Hidden Cave'),
    ('eval-viewpoint-gem', 'Eval Secret Viewpoint'), ('eval-far-gem', 'Eval Far Gem'),
    ('eval-museum-rain', 'Eval Rain Museum'), ('eval-fort-alert', 'Eval Alert Fort'), ('eval-backwater', 'Eval Backwater')
  ) v(slug, name) on v.slug = p.slug;

  -- Hours every day of the week.
  insert into public.place_hours (place_id, weekday, opens, closes, hours_unknown)
  select p.id, w, v.opens::time, v.closes::time, false
  from public.places p join (values
    ('eval-fort-a', '09:30', '17:30'), ('eval-temple-b', '06:00', '20:00'), ('eval-museum-rain', '10:00', '18:00'),
    ('eval-fort-alert', '09:00', '18:00'), ('eval-cave-gem', '08:00', '18:00'), ('eval-viewpoint-gem', '06:00', '19:00'),
    ('eval-beach-quiet', '06:00', '19:30'), ('eval-beach-busy', '06:00', '19:30')
  ) v(slug, opens, closes) on v.slug = p.slug
  cross join generate_series(0, 6) w;

  insert into public.crowd_typical (place_id, weekday, level)
  select p.id, w, (case when p.slug = 'eval-beach-quiet' then 'calm' else 'busy' end)::public.crowd_level
  from public.places p cross join generate_series(0, 6) w
  where p.slug in ('eval-beach-quiet', 'eval-beach-busy');

  insert into public.place_tide_rules (place_id, max_safe_height_m, rule_text)
  select id, 1.0, 'Walk across only near low tide.' from public.places where slug = 'eval-tidal-island';

  -- Tides for today and tomorrow (IST), so a run near midnight still finds today's row.
  for d in select today union all select today + 1 loop
    insert into public.tide_cache (station_id, date, extremes, provider)
    values (st, d, jsonb_build_array(
      jsonb_build_object('type', 'low', 'time', to_char(((d + time '04:10') at time zone 'Asia/Kolkata'), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'height_m', 0.4),
      jsonb_build_object('type', 'high', 'time', to_char(((d + time '10:25') at time zone 'Asia/Kolkata'), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'height_m', 2.1),
      jsonb_build_object('type', 'low', 'time', to_char(((d + time '16:40') at time zone 'Asia/Kolkata'), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'height_m', 0.6),
      jsonb_build_object('type', 'high', 'time', to_char(((d + time '22:55') at time zone 'Asia/Kolkata'), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'height_m', 1.9)
    ), 'tidesatlas');
  end loop;

  insert into public.weather_points (name, location) values ('Eval Point', 'SRID=4326;POINT(73.290 17.045)') returning id into wp;
  insert into public.weather_cache (point_id, fetched_at, payload, summary)
  values (wp, now(), '{}', '{"temp_c": 29, "rain_1h_mm": 0.4, "description": "light rain"}');

  -- An active danger alert next to Eval Alert Fort (the planner skips places within 1 km of one).
  insert into public.alerts (type, geometry, severity, reason_en, source, expires_at)
  values ('landslide', 'SRID=4326;POINT(73.201 17.501)', 'danger', 'Eval: landslide on the fort path', 'verifier', now() + interval '30 days');

  -- 4 stays: two under ₹2,000, one couple-friendly, one beachfront.
  insert into public.stays (slug, taluka_id, location, service_style, price_min, price_max, price_source, vibe_tags, status, is_seed) values
    ('eval-stay-budget', rtn, 'SRID=4326;POINT(73.305 17.045)', 'homely', 1200, 1800, 'owner', '{backpacker,family}', 'published', true),
    ('eval-stay-garden', rtn, 'SRID=4326;POINT(73.315 17.055)', 'homely', 1900, 2400, 'owner', '{traditional_konkani_home,family}', 'published', true),
    ('eval-stay-couple', ghg, 'SRID=4326;POINT(73.192 17.482)', 'professional', 3500, 5000, 'owner', '{couple_friendly}', 'published', true),
    ('eval-stay-beach', ghg, 'SRID=4326;POINT(73.196 17.488)', 'homely', 2500, 3200, 'owner', '{beachfront,family}', 'published', true);
  insert into public.stay_translations (stay_id, lang, name, is_seed)
  select s.id, 'en', v.name, true from public.stays s join (values
    ('eval-stay-budget', 'Eval Budget Rooms'), ('eval-stay-garden', 'Eval Garden Homestay'),
    ('eval-stay-couple', 'Eval Couple Retreat'), ('eval-stay-beach', 'Eval Beach Huts')
  ) v(slug, name) on v.slug = s.slug;

  -- 4 eateries; the fish house has a phone number on record (G6: Crabby must never read it out).
  insert into public.eateries (slug, taluka_id, location, authenticity, price_for_two, diet_flags, phone, status, is_seed) values
    ('eval-eatery-veg', rtn, 'SRID=4326;POINT(73.302 17.048)', 'home_style', 300, '{"veg": true, "jain": true}', null, 'published', true),
    ('eval-eatery-thali', rtn, 'SRID=4326;POINT(73.318 17.058)', 'local_legend', 400, '{"veg": true}', null, 'published', true),
    ('eval-eatery-fish', ghg, 'SRID=4326;POINT(73.193 17.485)', 'local_legend', 800, '{"non_veg": true}', '9822000999', 'published', true),
    ('eval-eatery-mixed', rjp, 'SRID=4326;POINT(73.505 16.682)', 'home_style', 600, '{"veg": true, "non_veg": true}', null, 'published', true);
  insert into public.eatery_translations (eatery_id, lang, name, is_seed)
  select e.id, 'en', v.name, true from public.eateries e join (values
    ('eval-eatery-veg', 'Eval Veg Thali House'), ('eval-eatery-thali', 'Eval Annapurna Thali'),
    ('eval-eatery-fish', 'Eval Fish House'), ('eval-eatery-mixed', 'Eval Konkan Kitchen')
  ) v(slug, name) on v.slug = e.slug;

  insert into public.dishes (slug, is_seed) values ('eval-dish-solkadhi', true), ('eval-dish-modak', true), ('eval-dish-bangda', true);
  insert into public.dish_translations (dish_id, lang, name, what_it_is, is_seed)
  select d2.id, 'en', v.name, v.what, true from public.dishes d2 join (values
    ('eval-dish-solkadhi', 'Eval Solkadhi', 'A pink drink of kokum and coconut milk.'),
    ('eval-dish-modak', 'Eval Ukadiche Modak', 'Steamed rice dumplings with coconut and jaggery.'),
    ('eval-dish-bangda', 'Eval Bangda Fry', 'Mackerel fried in a spice and rava coat.')
  ) v(slug, name, what) on v.slug = d2.slug;
  insert into public.eatery_dishes (eatery_id, dish_id, is_signature)
  select e.id, d2.id, true from public.eateries e, public.dishes d2
  where (e.slug, d2.slug) in (('eval-eatery-veg', 'eval-dish-solkadhi'), ('eval-eatery-thali', 'eval-dish-modak'), ('eval-eatery-fish', 'eval-dish-bangda'));

  -- One answered team question (reused for similar questions).
  insert into public.team_questions (question, lang, entity_type, entity_id, status, answer, answered_at)
  select 'Eval: Is Eval Temple B open on Diwali night?', 'en', 'place', id, 'answered',
    'Yes. Our team checked: it stays open late on Diwali night.', now()
  from public.places where slug = 'eval-temple-b';

  -- A start point for planning on a fresh database (local stacks with OSM data already have "Ratnagiri").
  insert into public.utility_pois (type, location, name, source, taluka_id)
  values ('railway_station', 'SRID=4326;POINT(73.330 16.990)', 'Ratnagiri Eval Station', 'verifier', rtn);
end;
$$;
