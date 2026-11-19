-- T3-02: plaque health — distinct visitors per window, open broken-QR reports, silent installed plaques.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select ok(not has_function_privilege('anon', 'public.qr_plaque_health()', 'execute'), 'anon cannot read plaque health');
select ok(not has_function_privilege('authenticated', 'public.qr_plaque_health()', 'execute'), 'users cannot either');
select ok(has_function_privilege('service_role', 'public.qr_plaque_health()', 'execute'), 'the server can');

insert into public.qr_codes (code, entity_type, entity_id, installed_at)
select 'ZZH-001', 'place', id, now() - interval '60 days' from public.places where slug = 'seed-fort-1';
insert into public.qr_codes (code, entity_type, entity_id, installed_at)
select 'ZZH-002', 'place', id, now() - interval '60 days' from public.places where slug = 'seed-beach-1';
insert into public.qr_codes (code, entity_type, entity_id, installed_at)
select 'ZZH-003', 'place', id, now() - interval '3 days' from public.places where slug = 'seed-temple-1';

-- ZZH-001: one visitor twice this week, another 20 days ago, a third 40 days ago (outside both windows).
insert into public.qr_scans (code, scanned_at, client_key, session_hash) values
  ('ZZH-001', now() - interval '1 days', repeat('a', 64), repeat('a', 64)),
  ('ZZH-001', now() - interval '2 days', repeat('a', 64), repeat('a', 64)),
  ('ZZH-001', now() - interval '20 days', repeat('b', 64), repeat('b', 64)),
  ('ZZH-001', now() - interval '40 days', repeat('c', 64), repeat('c', 64));
insert into public.reports (entity_type, entity_id, qr_code, type, status)
select 'place', p.id, 'ZZH-001', v.t::public.report_type, v.s::public.report_status
from public.places p, (values ('broken_qr', 'new'), ('broken_qr', 'fixed'), ('garbage', 'new')) v(t, s)
where p.slug = 'seed-fort-1';

select is((select scans_7d from public.qr_plaque_health() where code = 'ZZH-001'), 1, 'one distinct visitor in 7 days');
select is((select scans_30d from public.qr_plaque_health() where code = 'ZZH-001'), 2, 'two distinct visitors in 30 days');
select is((select broken_open from public.qr_plaque_health() where code = 'ZZH-001'), 1, 'only open broken-QR reports count');
select is((select silent from public.qr_plaque_health() where code = 'ZZH-001'), false, 'a scanned plaque is not silent');
select is((select silent from public.qr_plaque_health() where code = 'ZZH-002'), true, 'installed 60 days ago, no scans: silent');
select is((select silent from public.qr_plaque_health() where code = 'ZZH-003'), false, 'installed 3 days ago: not flagged yet');

select * from finish();
rollback;
