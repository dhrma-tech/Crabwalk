-- SEC-15: idle guests go after 30 days (active ones and real accounts stay); scan positions after 24 h;
-- limiter windows after a day.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, is_anonymous, created_at, updated_at, last_sign_in_at) values
  ('00000000-0000-0000-0119-0000000000a1', null, true, now() - interval '40 days', now() - interval '40 days', now() - interval '40 days'),
  ('00000000-0000-0000-0119-0000000000a2', null, true, now() - interval '40 days', now() - interval '40 days', now() - interval '40 days'),
  ('00000000-0000-0000-0119-0000000000a3', null, true, now() - interval '5 days', now() - interval '5 days', now() - interval '5 days'),
  ('00000000-0000-0000-0119-0000000000a4', 'ret-real@test.local', false, now() - interval '400 days', now() - interval '400 days', now() - interval '400 days');
-- Guest a2 signed in 40 days ago but its session refreshed yesterday: still active.
insert into auth.sessions (id, user_id, created_at, updated_at, refreshed_at)
values (gen_random_uuid(), '00000000-0000-0000-0119-0000000000a2', now() - interval '40 days', now() - interval '1 day', (now() - interval '1 day')::timestamp);
-- Guest a1 has a trip: it goes with the account.
insert into public.trips (owner_id, title, days) values ('00000000-0000-0000-0119-0000000000a1', 'Old guest trip', 1);

select ok(not has_function_privilege('authenticated', 'app.purge_idle_guests(integer)', 'execute'), 'users cannot run the purge');
select is(app.purge_idle_guests(), 1, 'one idle guest removed');
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0119-0000000000a1'), 0, 'the idle guest is gone');
select is((select count(*)::int from public.trips where title = 'Old guest trip'), 0, 'with their trip');
select is((select count(*)::int from auth.users where id in ('00000000-0000-0000-0119-0000000000a2',
  '00000000-0000-0000-0119-0000000000a3', '00000000-0000-0000-0119-0000000000a4')), 3,
  'a guest whose session refreshed recently, a new guest and a real account stay');

-- Scan positions and limiter windows.
insert into public.qr_codes (code, entity_type, entity_id) select 'TSTP-9401', 'place', id from public.places limit 1;
insert into public.qr_scans (code, lang, session_hash, lat, lng, scanned_at) values
  ('TSTP-9401', 'en', repeat('a', 64), 17, 73.3, now() - interval '25 hours'),
  ('TSTP-9401', 'en', repeat('b', 64), 17, 73.3, now() - interval '2 hours');
insert into public.rate_hits (key, window_start, hits) values
  (repeat('c', 64), now() - interval '2 days', 3), (repeat('d', 64), now(), 1);
select app.purge_short_lived();
select is((select count(*)::int from public.qr_scans where code = 'TSTP-9401' and lat is null), 1, 'old scan loses its position');
select is((select count(*)::int from public.qr_scans where code = 'TSTP-9401'), 2, 'the scan itself stays (heatmap)');
select is((select count(*)::int from public.rate_hits where key in (repeat('c', 64), repeat('d', 64))), 1, 'old limiter window deleted');
select ok(exists (select 1 from cron.job where jobname = 'retention-idle-guests'), 'guest purge is scheduled');
select ok(exists (select 1 from cron.job where jobname = 'retention-short-lived'), 'hourly purge is scheduled');

select * from finish();
rollback;
