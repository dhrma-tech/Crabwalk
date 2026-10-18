-- P9: heatmap always labelled Live/Typical (G10); dwell + push only with consent, revocable; alerts expire
-- and re-confirm by TTL (G9); trail difficulty scale; pattern stats (dwell median, trending); nav legs.
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
  ('00000000-0000-0000-0009-0000000000a1', 'p9a@test.local'),
  ('00000000-0000-0000-0009-0000000000b1', 'p9v@test.local');
insert into public.user_roles (user_id, role, taluka_id)
select '00000000-0000-0000-0009-0000000000b1', 'verifier', id from public.talukas where name_en = 'Ratnagiri';

create temp table ids as
select (select id from public.talukas where name_en = 'Ratnagiri') t, gen_random_uuid() busy, gen_random_uuid() calm, gen_random_uuid() p3;
grant select on ids to authenticated, anon;
-- Three places far from other fixtures (box 80.0–80.2 / 20.0–20.2).
insert into public.places (id, slug, category, taluka_id, location, status)
select busy, 'p9-busy', 'beach'::public.place_category, t, 'SRID=4326;POINT(80.05 20.05)'::extensions.geography, 'published'::public.content_status from ids union all
select calm, 'p9-calm', 'fort', t, 'SRID=4326;POINT(80.1 20.1)', 'published' from ids union all
select p3, 'p9-p3', 'temple', t, 'SRID=4326;POINT(80.15 20.15)', 'published' from ids;
insert into public.crowd_typical (place_id, weekday, level)
select calm, extract(dow from now() at time zone 'Asia/Kolkata')::smallint, 'calm' from ids;
insert into public.qr_codes (code, entity_type, entity_id) select 'TSTP-9001', 'place', busy from ids;
insert into public.qr_scans (code, session_hash, scanned_at)
select 'TSTP-9001', md5(g::text) || md5(g::text), now() - interval '10 minutes' from generate_series(1, 5) g;

-- ------------------------------------------------ heatmap labels its source every time
select pg_temp.anon();
select is((select source from public.map_heatmap(80, 20, 80.2, 20.2) where slug = 'p9-busy'), 'live', '≥ 5 distinct sessions in the window → Live');
select is((select source from public.map_heatmap(80, 20, 80.2, 20.2) where slug = 'p9-calm'), 'typical', 'otherwise → Typical (crowd_typical today)');
select is((select count(*)::int from public.map_heatmap(80, 20, 80.2, 20.2) where source not in ('live', 'typical')), 0, 'no unlabelled points');
select ok(not exists (select 1 from public.map_heatmap(80, 20, 80.2, 20.2) where slug = 'p9-p3'), 'no data → no point (nothing invented)');
select pg_temp.root();
delete from public.qr_scans where code = 'TSTP-9001' and session_hash = md5('5') || md5('5');
select pg_temp.anon();
select ok(not exists (select 1 from public.map_heatmap(80, 20, 80.2, 20.2) where slug = 'p9-busy' and source = 'live'), '4 sessions is not Live');

-- ------------------------------------------------ dwell only with consent; revocable
select pg_temp.login('00000000-0000-0000-0009-0000000000a1');
select throws_ok($$ insert into public.dwell_events (anon_id, place_id, arrived_at, left_at) select gen_random_uuid()::text, calm, now() - interval '1 hour', now() from ids $$, '42501', null, 'no dwell rows without consent');
insert into public.consents (user_id, type, granted, granted_at) values ('00000000-0000-0000-0009-0000000000a1', 'dwell_time', true, now());
select lives_ok($$ insert into public.dwell_events (anon_id, place_id, arrived_at, left_at) select gen_random_uuid()::text, calm, now() - interval '1 hour', now() from ids $$, 'dwell accepted with consent');
select throws_ok($$ insert into public.dwell_events (anon_id, place_id, arrived_at) select 'user@example.com', calm, now() from ids $$, '23514', null, 'anon id must be a random uuid (no identifiers)');
update public.consents set granted = false, revoked_at = now() where user_id = '00000000-0000-0000-0009-0000000000a1' and type = 'dwell_time';
select throws_ok($$ insert into public.dwell_events (anon_id, place_id, arrived_at) select gen_random_uuid()::text, calm, now() from ids $$, '42501', null, 'revoked consent stops collection');
select is((select count(*)::int from public.dwell_events), 0, 'users cannot read dwell rows');

-- ------------------------------------------------ push only with consent; revoke removes subscriptions
select throws_ok($$ insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ('00000000-0000-0000-0009-0000000000a1', 'https://push.example/1', 'k', 'a') $$, '42501', null, 'no subscription without push consent');
insert into public.consents (user_id, type, granted, granted_at) values ('00000000-0000-0000-0009-0000000000a1', 'push', true, now());
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ('00000000-0000-0000-0009-0000000000a1', 'https://push.example/1', 'k', 'a');
select is((select count(*)::int from public.push_subscriptions), 1, 'subscribed after consent');
update public.consents set granted = false, revoked_at = now() where user_id = '00000000-0000-0000-0009-0000000000a1' and type = 'push';
select is((select count(*)::int from public.push_subscriptions), 0, 'revoking push consent deletes subscriptions');

-- ------------------------------------------------ alerts: TTL expiry + re-confirm (G9)
select pg_temp.login('00000000-0000-0000-0009-0000000000b1');
create temp table al as select gen_random_uuid() id;
grant select on al to authenticated, anon;
insert into public.alerts (id, type, geometry, severity, source, reported_at, expires_at)
select id, 'landslide', 'SRID=4326;POINT(80.1 20.1)', 'danger', 'verifier', now() - interval '47 hours', now() + interval '1 hour' from al;
select pg_temp.anon();
select is((select count(*)::int from public.map_alerts(80, 20, 80.2, 20.2)), 1, 'active alert shown');
select throws_ok($$ select public.confirm_alert((select id from al)) $$, '42501', null, 'anon cannot re-confirm');
select pg_temp.login('00000000-0000-0000-0009-0000000000b1');
select ok(public.confirm_alert((select id from al)) > now() + interval '47 hours', 'landslide re-confirm extends by its 48 h TTL');
update public.alerts set expires_at = now() - interval '1 minute' where id = (select id from al);
select pg_temp.anon();
select is((select count(*)::int from public.map_alerts(80, 20, 80.2, 20.2)), 0, 'expired alert disappears');

-- ------------------------------------------------ trails difficulty scale (P9-1)
select pg_temp.root();
select throws_ok($$ insert into public.trails (name_en, source, difficulty) values ('x', 'osm', 'extreme') $$, '23514', null, 'only easy / moderate / hard');
select lives_ok($$ insert into public.trails (name_en, source, difficulty, geometry) values ('P9 trail', 'osm', 'moderate', 'SRID=4326;LINESTRING(80.1 20.1, 80.11 20.11)') $$, 'valid trail');
select pg_temp.anon();
select is((select difficulty from public.map_trails(80, 20, 80.2, 20.2) where name_en = 'P9 trail'), 'moderate', 'trails layer returns difficulty');

-- ------------------------------------------------ pattern analysis
select pg_temp.root();
insert into public.dwell_events (anon_id, place_id, arrived_at, left_at)
select gen_random_uuid()::text, calm, now() - (m || ' minutes')::interval, now() from ids, unnest(array[30, 40, 50, 60, 70]) m;
create temp table tr as
select gen_random_uuid() id from generate_series(1, 3);
insert into public.trips (id, owner_id, title, days, status) select id, '00000000-0000-0000-0009-0000000000a1', 'p9', 1, 'saved' from tr;
insert into public.trip_stops (trip_id, day, "order", entity_type, entity_id, kind)
select tr.id, 1, 0, 'place'::public.entity_type, ids.busy, 'place'::public.stop_kind from tr, ids union all
select tr.id, 1, 1, 'place', ids.calm, 'place' from tr, ids;
select public.refresh_patterns();
-- 6 visits: the consented 60-min one above + 30, 40, 50, 60, 70 → median 55.
select is((select dwell_minutes from public.places where slug = 'p9-calm'), 55::smallint, 'dwell median (≥ 5 consented visits) updates typical visit time');
select ok(exists (select 1 from public.route_stats where kind = 'trending' and stops = array[(select busy from ids), (select calm from ids)]), 'pair planned in ≥ 3 saved trips is trending');
select pg_temp.login('00000000-0000-0000-0009-0000000000a1');
select throws_ok($$ select public.refresh_patterns() $$, '42501', null, 'only the scheduler refreshes patterns');

-- ------------------------------------------------ navigation legs
select pg_temp.root();
insert into public.matrix_points (entity_type, entity_id, location)
select 'place'::public.entity_type, busy, 'SRID=4326;POINT(80.05 20.05)'::extensions.geography from ids union all
select 'place', calm, 'SRID=4326;POINT(80.1 20.1)' from ids;
insert into public.travel_matrix (from_point_id, to_point_id, duration_s, distance_m, duration_corrected_s, route_shape, route_turns)
select a.id, b.id, 600, 8000, 700, '_p~iF~ps|U', '3L' from public.matrix_points a, public.matrix_points b, ids
where a.entity_id = ids.busy and b.entity_id = ids.calm;
select pg_temp.anon();
select is((select turns from public.nav_leg((select busy from ids), (select calm from ids))), '3L', 'stored turn cues returned');
select is((select duration_s from public.nav_leg((select busy from ids), (select calm from ids))), 700, 'corrected duration returned');

select * from finish();
rollback;
