-- Photo credits (DECISIONS T-7 / T-51): own photo = no credit; licensed photo = credit + CC licence + https source.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values ('00000000-0000-0000-0011-0000000000a1', 'photographer@test.local');
create temp table t as select gen_random_uuid() as place;

select lives_ok(
  $$insert into public.photos (entity_type, entity_id, storage_path, uploaded_by)
    select 'place', place, 'place/x/own', '00000000-0000-0000-0011-0000000000a1' from t$$,
  'our own photo needs no credit');
select lives_ok(
  $$insert into public.photos (entity_type, entity_id, storage_path, uploaded_by, credit, licence, source_url)
    select 'place', place, 'place/x/cc', '00000000-0000-0000-0011-0000000000a1',
           'A. Photographer', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:X.jpg' from t$$,
  'a CC BY-SA photo with author and source');
select throws_ok(
  $$insert into public.photos (entity_type, entity_id, storage_path, uploaded_by, credit)
    select 'place', place, 'place/x/half', '00000000-0000-0000-0011-0000000000a1', 'Someone' from t$$,
  '23514', null, 'a credit without licence and source is refused');
select throws_ok(
  $$insert into public.photos (entity_type, entity_id, storage_path, uploaded_by, credit, licence, source_url)
    select 'place', place, 'place/x/nc', '00000000-0000-0000-0011-0000000000a1',
           'Someone', 'CC BY-NC 4.0', 'https://example.org/p' from t$$,
  '23514', null, 'a non-commercial (or any non-listed) licence is refused');
select throws_ok(
  $$insert into public.photos (entity_type, entity_id, storage_path, uploaded_by, credit, licence, source_url)
    select 'place', place, 'place/x/http', '00000000-0000-0000-0011-0000000000a1',
           'Someone', 'CC BY 4.0', 'http://example.org/p' from t$$,
  '23514', null, 'the source must be https');

-- Review (T-51): a reviewer fixes the credit on a photo someone else uploaded; a plain user cannot.
create function pg_temp.login(_uid uuid) returns void language plpgsql as $f$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', _uid, 'role', 'authenticated')::text, true);
end;
$f$;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0011-0000000000b1', 'credit-reviewer@test.local'),
  ('00000000-0000-0000-0011-0000000000c1', 'credit-user@test.local');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0011-0000000000b1', 'reviewer');
grant select on t to authenticated;

select pg_temp.login('00000000-0000-0000-0011-0000000000c1');
update public.photos set credit = 'X', licence = 'CC BY 4.0', source_url = 'https://x.org/p' where storage_path = 'place/x/own';
reset role;
select is((select credit from public.photos where storage_path = 'place/x/own'), null, 'a plain user cannot change a photo credit');

select pg_temp.login('00000000-0000-0000-0011-0000000000b1');
select lives_ok(
  $$update public.photos set credit = 'Fixed Author', licence = 'CC BY 4.0', source_url = 'https://x.org/p'
    where storage_path = 'place/x/own'$$,
  'a reviewer updates the credit');
reset role;
select is((select credit from public.photos where storage_path = 'place/x/own'), 'Fixed Author', 'the reviewer''s credit is saved');

select * from finish();
rollback;
