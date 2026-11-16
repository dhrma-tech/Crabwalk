-- Field-form IDs are assigned by the database: next number per region + type, existing IDs kept.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select is((select count(*) from public.places where code is null), 0::bigint, 'every place has an ID');
select is((select count(*) from public.dishes where code is null), 0::bigint, 'every dish has an ID');

-- A new place gets the next number after the highest one under its region prefix.
insert into public.places (id, slug, category, taluka_id, location, status, verification_method)
values ('00000000-0000-0000-0098-0000000000f1', 'auto-code-a', 'beach',
        (select id from public.talukas order by name_en limit 1), 'SRID=4326;POINT(73.3 16.99)', 'draft', 'field');
select is(
  (select code from public.places where id = '00000000-0000-0000-0098-0000000000f1'),
  (select r.code_prefix || '-P-' || lpad((coalesce(max(right(p.code, 3)::int), 0))::text, 3, '0')
     from public.places p, public.regions r
    where p.code like r.code_prefix || '-P-%' group by r.code_prefix limit 1),
  'new place gets <REGION>-P-<next>'
);

-- An ID given on insert is kept.
insert into public.places (id, slug, category, taluka_id, location, status, verification_method, code)
values ('00000000-0000-0000-0098-0000000000f2', 'auto-code-b', 'beach',
        (select id from public.talukas order by name_en limit 1), 'SRID=4326;POINT(73.3 16.99)', 'draft', 'field', 'RTN-P-900');
select is((select code from public.places where id = '00000000-0000-0000-0098-0000000000f2'), 'RTN-P-900', 'given ID kept');

-- Clearing an ID gets a fresh one instead of leaving it empty.
update public.places set code = null where id = '00000000-0000-0000-0098-0000000000f2';
select is((select code from public.places where id = '00000000-0000-0000-0098-0000000000f2'), 'RTN-P-901', 'cleared ID refilled');

insert into public.dishes (id, slug) values ('00000000-0000-0000-0098-0000000000d1', 'auto-code-dish');
select matches((select code from public.dishes where id = '00000000-0000-0000-0098-0000000000d1'), '^DISH-[0-9]{3}$', 'new dish gets DISH-<n>');

select * from finish();
rollback;
