-- Place provenance (DECISIONS T-6 / T-48): field by default; a desk row needs 1–10 source URLs.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select has_column('public', 'places', 'verification_method', 'places.verification_method exists');
select col_default_is('public', 'places', 'verification_method', 'field', 'existing and field-form rows are field');
select has_column('public', 'places', 'source_urls', 'places.source_urls exists');
select enum_has_labels('public', 'verification_method', array['desk', 'field'], 'desk / field');

create temp table t as select (select id from public.talukas where name_en = 'Ratnagiri') as taluka;

select lives_ok(
  $$insert into public.places (slug, category, taluka_id, location, status)
    select 'prov-field', 'beach', taluka, 'SRID=4326;POINT(73.27 16.99)', 'in_review' from t$$,
  'a field row needs no sources');
select is((select verification_method::text from public.places where slug = 'prov-field'), 'field', 'defaults to field');

select throws_ok(
  $$insert into public.places (slug, category, taluka_id, location, status, verification_method)
    select 'prov-desk-none', 'beach', taluka, 'SRID=4326;POINT(73.27 16.99)', 'in_review', 'desk' from t$$,
  '23514', null, 'a desk row without sources is refused');
select lives_ok(
  $$insert into public.places (slug, category, taluka_id, location, status, verification_method, source_urls)
    select 'prov-desk', 'beach', taluka, 'SRID=4326;POINT(73.27 16.99)', 'in_review', 'desk',
           array['https://example.org/a'] from t$$,
  'a desk row with a source is fine');
select throws_ok(
  $$insert into public.places (slug, category, taluka_id, location, status, source_urls)
    select 'prov-many', 'beach', taluka, 'SRID=4326;POINT(73.27 16.99)', 'in_review',
           array_fill('https://example.org'::text, array[11]) from t$$,
  '23514', null, 'more than 10 sources is refused');

select * from finish();
rollback;
