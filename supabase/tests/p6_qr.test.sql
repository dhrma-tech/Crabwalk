-- P6: short code generator, scans (anon, dedupe), GPS-verified visit (server distance, 199 m pass / 250 m fail),
-- Near me now, QR as a report source.
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
  ('00000000-0000-0000-0006-0000000000a1', 'p6admin@test.local'),
  ('00000000-0000-0000-0006-0000000000b1', 'p6user@test.local');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0006-0000000000a1', 'admin');

create temp table ids as
select (select id from public.talukas where name_en = 'Ratnagiri') t, gen_random_uuid() place, gen_random_uuid() place2,
       gen_random_uuid() eat, gen_random_uuid() station, gen_random_uuid() fuel;
grant select on ids to authenticated, anon;
-- Place at (73.3, 17.0). 0.0018Â° lat â‰ˆ 199 m, 0.00225Â° â‰ˆ 250 m.
insert into public.places (id, slug, category, taluka_id, location, status)
select place, 'p6-place', 'fort', t, 'SRID=4326;POINT(73.3 17)', 'published' from ids;
insert into public.places (id, slug, category, taluka_id, location, status)
select place2, 'p6-place2', 'beach', t, 'SRID=4326;POINT(73.31 17.01)', 'published' from ids;
insert into public.place_translations (place_id, lang, name) select place2, 'en', 'P6 Beach' from ids;
insert into public.eateries (id, slug, taluka_id, location, status) select eat, 'p6-eat', t, 'SRID=4326;POINT(73.301 17)', 'published' from ids;
insert into public.utility_pois (id, type, location, name, source, taluka_id)
select station, 'railway_station', 'SRID=4326;POINT(73.32 17.02)', 'P6 Station', 'osm', t from ids;
insert into public.utility_pois (id, type, location, name, source, taluka_id)
select fuel, 'fuel', 'SRID=4326;POINT(73.302 17)', 'P6 Fuel', 'osm', t from ids;

-- ------------------------------------------------ code generator
select pg_temp.login('00000000-0000-0000-0006-0000000000b1');
select throws_ok($$ select public.create_qr_code('place', (select place from ids)) $$, '42501', null, 'non-admin cannot create codes');

select pg_temp.login('00000000-0000-0000-0006-0000000000a1');
create temp table codes (k text, code text);
grant all on codes to authenticated, anon;
insert into codes select 'place', public.create_qr_code('place', place) from ids;
insert into codes select 'eat', public.create_qr_code('eatery', eat) from ids;
insert into codes select 'station', public.create_qr_code('station', station) from ids;
select matches((select code from codes where k = 'place'), '^RTN-[0-9]{3,}$', 'code = region prefix + 3 digits');
select is(split_part((select code from codes where k = 'eat'), '-', 2)::int,
          split_part((select code from codes where k = 'place'), '-', 2)::int + 1, 'codes are sequential per prefix');
select throws_ok($$ select public.create_qr_code('station', (select fuel from ids)) $$, '23503', null, 'station code needs a railway_station POI');
select throws_ok($$ delete from public.qr_codes where code = (select code from codes where k = 'eat') $$, '42501', null, 'codes cannot be deleted, even by admins');

-- ------------------------------------------------ scans
select pg_temp.anon();
select lives_ok($$ select public.qr_record_scan((select code from codes where k = 'place'), repeat('ab', 32), 'en', null, null) $$, 'anon can record a scan');
select public.qr_record_scan((select code from codes where k = 'place'), repeat('ab', 32), 'en', null, null);
select throws_ok($$ select public.qr_record_scan((select code from codes where k = 'place'), 'not-a-hash', 'en', null, null) $$, '22023', null, 'session hash validated');
select is((select count(*)::int from public.qr_scans), 0, 'qr_scans not readable by clients (RLS, no policies)');
select pg_temp.root();
select is((select count(*)::int from public.qr_scans where code = (select code from codes where k = 'place')), 1, 'same session within 10 min = one row');

-- ------------------------------------------------ verified visit
select pg_temp.anon();
select throws_ok($$ select * from public.qr_verify_visit((select code from codes where k = 'place'), 17.0018, 73.3) $$, '42501', null, 'anon cannot verify a visit');

select pg_temp.login('00000000-0000-0000-0006-0000000000b1');
select is((select verified from public.qr_verify_visit((select code from codes where k = 'place'), 17.00225, 73.3)), false, '250 m fails');
select is((select count(*)::int from public.verified_visits), 0, 'failed check inserts nothing');
select is((select verified from public.qr_verify_visit((select code from codes where k = 'place'), 17.0018, 73.3)), true, '199 m passes');
select ok((select distance_m from public.qr_verify_visit((select code from codes where k = 'place'), 17.0018, 73.3)) between 195 and 200, 'distance computed server-side (~199 m)');
select is((select count(*)::int from public.verified_visits where method = 'qr_gps'), 1, 'one qr_gps visit per day');
select throws_ok($$ select * from public.qr_verify_visit((select code from codes where k = 'station'), 17.02, 73.32) $$, 'P0002', null, 'station code has no listing to verify');
select throws_ok($$ insert into public.verified_visits (user_id, entity_type, entity_id, method) values ('00000000-0000-0000-0006-0000000000b1', 'place', (select place from ids), 'qr_gps') $$, '42501', null, 'clients cannot insert visits directly');

-- Verified at the eatery â†’ hygiene sub-score allowed.
select is((select verified from public.qr_verify_visit((select code from codes where k = 'eat'), 17, 73.301)), true, 'eatery visit verified');
select lives_ok($$ insert into public.sub_scores (user_id, entity_type, entity_id, dimension, score) values ('00000000-0000-0000-0006-0000000000b1', 'eatery', (select eat from ids), 'hygiene', 4) $$, 'QR+GPS visit unlocks hygiene');

-- ------------------------------------------------ near me now
select pg_temp.anon();
select ok(exists (select 1 from public.qr_near_me((select code from codes where k = 'place')) where kind = 'eatery' and slug = 'p6-eat'), 'nearest eatery listed');
select ok(exists (select 1 from public.qr_near_me((select code from codes where k = 'place')) where kind = 'utility' and sub = 'fuel'), 'nearest fuel listed');
select ok(exists (select 1 from public.qr_near_me((select code from codes where k = 'place')) where kind = 'place' and name_en = 'P6 Beach'), 'next spot listed');
select ok(not exists (select 1 from public.qr_near_me((select code from codes where k = 'place')) where kind = 'place' and slug = 'p6-place'), 'own place excluded');

-- ------------------------------------------------ reports from a QR
select lives_ok($$ insert into public.reports (entity_type, entity_id, qr_code, type) values ('station', (select station from ids), (select code from codes where k = 'station'), 'broken_qr') $$, 'anon broken-QR report with qr_code');

select * from finish();
rollback;
