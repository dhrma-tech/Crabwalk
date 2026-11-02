-- Saved items (DECISIONS T-5 / T-46): own rows only; anon has no access; deleting the user deletes the rows.
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

insert into auth.users (id, email) values
  ('00000000-0000-0000-0010-0000000000a1', 'saver1@test.local'),
  ('00000000-0000-0000-0010-0000000000a2', 'saver2@test.local');

select has_table('public', 'saved_items', 'saved_items exists');
select col_is_pk('public', 'saved_items', array['user_id', 'entity_type', 'entity_id'], 'one row per user + listing');
select policies_are('public', 'saved_items', array['own read', 'own insert', 'own delete'], 'no update policy');

-- u1 saves two listings; user_id defaults to the caller.
select pg_temp.login('00000000-0000-0000-0010-0000000000a1');
select lives_ok(
  $$insert into public.saved_items (entity_type, entity_id) values
      ('place', '00000000-0000-0000-0010-0000000000f1'::uuid), ('stay', '00000000-0000-0000-0010-0000000000e1'::uuid)$$,
  'a user saves listings');
select throws_ok(
  $$insert into public.saved_items (entity_type, entity_id) values ('place', '00000000-0000-0000-0010-0000000000f1'::uuid)$$,
  '23505', null, 'saving twice is a duplicate');
select throws_ok(
  $$insert into public.saved_items (user_id, entity_type, entity_id)
    values ('00000000-0000-0000-0010-0000000000a2', 'place', '00000000-0000-0000-0010-0000000000f2'::uuid)$$,
  '42501', null, 'cannot save for someone else');
select is((select count(*)::int from public.saved_items), 2, 'u1 sees own rows');

-- u2 sees and deletes nothing of u1's.
select pg_temp.login('00000000-0000-0000-0010-0000000000a2');
select is((select count(*)::int from public.saved_items), 0, 'u2 sees none of u1''s rows');
delete from public.saved_items;
select pg_temp.login('00000000-0000-0000-0010-0000000000a1');
select is((select count(*)::int from public.saved_items), 2, 'u2 could not delete u1''s rows');

-- u1 removes one.
delete from public.saved_items where entity_type = 'stay';
select is((select count(*)::int from public.saved_items), 1, 'a user removes own row');

-- anon: no access at all.
select pg_temp.anon();
select throws_ok($$select count(*) from public.saved_items$$, '42501', null, 'anon cannot read');

-- Deleting the account deletes the rows.
reset role;
select set_config('request.jwt.claims', '', true);
delete from auth.users where id = '00000000-0000-0000-0010-0000000000a1';
select is(
  (select count(*)::int from public.saved_items where user_id = '00000000-0000-0000-0010-0000000000a1'), 0,
  'rows go with the account');

select * from finish();
rollback;
