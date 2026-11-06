-- Admin editor (ADMIN_ACCESS_CHANGES.md): team names/emails, private fields and form answers are unreadable by
-- anon and signed-in users; an editor save is all or nothing; the admin gate locks a client after 10 failures.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
end;
$$;
create function pg_temp.guest(_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', _uid, 'role', 'authenticated', 'is_anonymous', true)::text, true);
end;
$$;
create function pg_temp.service() returns void language plpgsql as $$
begin
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
end;
$$;

insert into auth.users (id, email) values ('00000000-0000-0000-0099-0000000000a1', null);
-- A published fixture place with team data, private notes and form answers.
insert into public.places (id, slug, category, taluka_id, location, status, verification_method)
values ('00000000-0000-0000-0099-0000000000f1', 'admin-test-fixture', 'beach',
        (select id from public.talukas order by name_en limit 1), 'SRID=4326;POINT(73.3 16.99)', 'published', 'field');
insert into public.place_translations (place_id, lang, name) values ('00000000-0000-0000-0099-0000000000f1', 'en', 'Fixture');
insert into public.listing_team (entity_type, entity_id, verified_by, reviewed_by, last_edited_by)
values ('place', '00000000-0000-0000-0099-0000000000f1', 'team@example.org', 'team@example.org', 'team@example.org');
insert into public.listing_private (entity_type, entity_id, owner_phone, internal_notes, source_notes)
values ('place', '00000000-0000-0000-0099-0000000000f1', '9876500000', 'secret note', 'told by priest');
insert into public.listing_form (entity_type, entity_id, data)
values ('place', '00000000-0000-0000-0099-0000000000f1', '{"village_or_area": "Mirya"}');

-- ---------------------------------------------------------------- team emails are not on public rows
select hasnt_column('public', t, c, format('%s.%s moved off the public row', t, c))
from unnest(array['places', 'stays', 'eateries', 'dishes']) t, unnest(array['verified_by', 'reviewed_by', 'last_edited_by']) c;

select pg_temp.anon();
select is((select count(*)::int from public.places where id = '00000000-0000-0000-0099-0000000000f1'), 1,
  'anon still reads the published place');
select throws_ok($$select verified_by from public.places$$, '42703', null, 'anon: no verified_by column on places');
select throws_ok($$select * from public.listing_team$$, '42501', null, 'anon cannot read listing_team');
select throws_ok($$select * from public.listing_private$$, '42501', null, 'anon cannot read listing_private');
select throws_ok($$select * from public.listing_form$$, '42501', null, 'anon cannot read listing_form');
select throws_ok($$select public.admin_apply_save('place', gen_random_uuid(), null, '{}')$$, '42501', null,
  'anon cannot call the editor save');
select throws_ok($$select public.gate_record('k', false)$$, '42501', null, 'anon cannot touch the gate counter');

select pg_temp.guest('00000000-0000-0000-0099-0000000000a1');
select throws_ok($$select * from public.listing_team$$, '42501', null, 'a signed-in guest cannot read listing_team');
select throws_ok($$select * from public.listing_private$$, '42501', null, 'a signed-in guest cannot read listing_private');
reset role;

-- ---------------------------------------------------------------- admin_apply_save is all or nothing
select pg_temp.service();
create temp table v as select updated_at from public.places where id = '00000000-0000-0000-0099-0000000000f1';
grant select on v to service_role;
-- A valid row patch + translation + form + private, then a child row the table rejects (weekday 9).
select throws_ok(
  $$select public.admin_apply_save('place', '00000000-0000-0000-0099-0000000000f1', (select updated_at from v), '{
      "row": {"best_time_text": "CHANGED"},
      "team": {"verified_by": "x@example.org", "reviewed_by": null, "last_edited_by": "x@example.org"},
      "tr": [{"lang": "en", "values": {"name": "CHANGED"}}],
      "form": {"village_or_area": "CHANGED"},
      "private": {"owner_phone": "9999999999", "internal_notes": "CHANGED", "source_notes": null},
      "children": [{"table": "place_hours", "key": "place_id",
        "rows": [{"place_id": "00000000-0000-0000-0099-0000000000f1", "weekday": 9, "opens": null, "closes": null, "hours_unknown": false}]}]
    }')$$,
  '23514', null, 'a failing part fails the whole save');
select is((select best_time_text from public.places where id = '00000000-0000-0000-0099-0000000000f1'), null,
  'partial failure: listing row unchanged');
select is((select name from public.place_translations where place_id = '00000000-0000-0000-0099-0000000000f1' and lang = 'en'),
  'Fixture', 'partial failure: translation unchanged');
select is((select data ->> 'village_or_area' from public.listing_form where entity_id = '00000000-0000-0000-0099-0000000000f1'),
  'Mirya', 'partial failure: form answers unchanged');
select is((select internal_notes from public.listing_private where entity_id = '00000000-0000-0000-0099-0000000000f1'),
  'secret note', 'partial failure: private fields unchanged');
select is((select verified_by from public.listing_team where entity_id = '00000000-0000-0000-0099-0000000000f1'),
  'team@example.org', 'partial failure: team row unchanged');
select is((select updated_at from public.places where id = '00000000-0000-0000-0099-0000000000f1'), (select updated_at from v),
  'partial failure: version unchanged');

-- The same save without the bad row goes through, every part at once.
select lives_ok(
  $$select public.admin_apply_save('place', '00000000-0000-0000-0099-0000000000f1', (select updated_at from v), '{
      "row": {"best_time_text": "Sunset"},
      "team": {"verified_by": "x@example.org", "reviewed_by": null, "last_edited_by": "x@example.org"},
      "tr": [{"lang": "en", "values": {"name": "Fixture beach"}}],
      "form": {"village_or_area": "Bhatye"},
      "children": [{"table": "place_hours", "key": "place_id",
        "rows": [{"place_id": "00000000-0000-0000-0099-0000000000f1", "weekday": 1, "opens": "06:00:00", "closes": "18:30:00", "hours_unknown": false}]}]
    }')$$, 'a valid save applies');
select is((select best_time_text || '|' || (select name from public.place_translations where place_id = p.id and lang = 'en')
           || '|' || (select data ->> 'village_or_area' from public.listing_form where entity_id = p.id)
           || '|' || (select count(*) from public.place_hours where place_id = p.id)
           || '|' || (select last_edited_by from public.listing_team where entity_id = p.id)
           from public.places p where id = '00000000-0000-0000-0099-0000000000f1'),
  'Sunset|Fixture beach|Bhatye|1|x@example.org', 'every part written');

-- A stale version (someone saved in between) writes nothing.
select throws_ok(
  $$select public.admin_apply_save('place', '00000000-0000-0000-0099-0000000000f1', (select updated_at from v), '{"row": {"best_time_text": "STALE"}}')$$,
  '40001', null, 'stale version is a conflict');
select is((select best_time_text from public.places where id = '00000000-0000-0000-0099-0000000000f1'), 'Sunset',
  'conflict: nothing overwritten');
select throws_ok(
  $$select public.admin_apply_save('place', '00000000-0000-0000-0099-0000000000f1', (select updated_at from public.places where id = '00000000-0000-0000-0099-0000000000f1'), '{"children": [{"table": "user_roles", "key": "user_id", "rows": []}]}')$$,
  '22023', null, 'only whitelisted child tables');

-- ---------------------------------------------------------------- admin gate lockout
select is((select count(*)::int from generate_series(1, 9) where public.gate_record('test-key', false) is not null), 0,
  '9 failures: not locked yet');
select isnt(public.gate_record('test-key', false), null, '10th failure locks the client');
select ok(public.gate_locked('test-key') between now() + interval '59 minutes' and now() + interval '61 minutes',
  'locked for an hour');
select is(public.gate_record('test-key', true), null, 'a success clears the counter');
select is(public.gate_locked('test-key'), null, 'not locked after clearing');
select is((select count(*)::int from generate_series(1, 9) where public.gate_record('other-key', false) is not null), 0,
  'other clients counted separately');

select * from finish();
rollback;
