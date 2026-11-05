-- Desk import schema (user 2026-11-05): unpinned drafts, pin and English text to publish, draft events, audit.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table t as select (select id from public.talukas where name_en = 'Ratnagiri') as taluka;

-- S1: no pin is fine for a draft, not for a published place.
select lives_ok(
  $$insert into public.places (slug, category, taluka_id, status, verification_method, source_urls)
    select 'desk-nopin', 'beach', taluka, 'in_review', 'desk', array['https://example.org/a'] from t$$,
  'a desk place without a pin can be saved');
insert into public.place_translations (place_id, lang, name, short_story)
  select id, 'en', 'No pin', 'A story.' from public.places where slug = 'desk-nopin';
select throws_ok(
  $$update public.places set status = 'published' where slug = 'desk-nopin'$$,
  '23514', null, 'a place without a pin cannot be published');

-- English text: refused without an English story, allowed once it exists.
insert into public.places (slug, category, taluka_id, location, status, verification_method, source_urls)
  select 'desk-noen', 'fort', taluka, 'SRID=4326;POINT(73.27 16.99)', 'draft', 'desk', array['https://example.org/a'] from t;
insert into public.place_translations (place_id, lang, name)
  select id, 'en', 'No English' from public.places where slug = 'desk-noen';
insert into public.place_translations (place_id, lang, name, short_story)
  select id, 'mr', 'इंग्रजी नाही', 'मराठी कथा.' from public.places where slug = 'desk-noen';
select throws_ok(
  $$update public.places set status = 'published' where slug = 'desk-noen'$$,
  '23514', 'English text needed to publish this place', 'no English story: cannot be published');
update public.place_translations set short_story = '  ' where lang = 'en'
  and place_id = (select id from public.places where slug = 'desk-noen');
select throws_ok(
  $$update public.places set status = 'published' where slug = 'desk-noen'$$,
  '23514', 'English text needed to publish this place', 'a blank story does not count');
update public.place_translations set short_story = 'A fort above the creek.' where lang = 'en'
  and place_id = (select id from public.places where slug = 'desk-noen');
select lives_ok(
  $$update public.places set status = 'published' where slug = 'desk-noen'$$,
  'with an English story it can be published');
select lives_ok(
  $$update public.places set entry_fee_text = 'Free' where slug = 'desk-noen'$$,
  'later edits of a published place are not re-checked');
insert into public.places (slug, category, taluka_id, location, status)
  select 'field-noen', 'fort', taluka, 'SRID=4326;POINT(73.27 16.99)', 'in_review' from t;
select lives_ok(
  $$update public.places set status = 'published' where slug = 'field-noen'$$,
  'field rows keep the earlier rule');

-- S2: draft events are hidden from the public.
insert into public.events_calendar (name_en, type, from_date, to_date, status)
  values ('Desk draft fair', 'jatra', '2026-12-01', '2026-12-02', 'draft'),
         ('Desk live fair', 'jatra', '2026-12-01', '2026-12-02', default);
insert into public.import_audit (entity_type, entity_key, source_file) values ('place', 'desk-noen', 'places/test.yaml');
set local role anon;
select is((select count(*)::int from public.events_calendar where name_en = 'Desk draft fair'), 0, 'anon: draft event hidden');
select is((select count(*)::int from public.events_calendar where name_en = 'Desk live fair'), 1, 'anon: published event visible');
-- S3: the audit table is staff only.
select is((select count(*)::int from public.import_audit), 0, 'anon: import_audit rows are not readable');
reset role;
select col_default_is('public', 'events_calendar', 'status', 'published'::public.content_status, 'admin-entered events stay published');

select * from finish();
rollback;
