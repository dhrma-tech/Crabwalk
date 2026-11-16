-- SEC-20: invite preview (title + role only) without joining.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.login(_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', _uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0117-0000000000a1', 'tip-owner@test.local'),
  ('00000000-0000-0000-0117-0000000000a2', 'tip-friend@test.local');
create temp table ids as select gen_random_uuid() trip;
grant select on ids to authenticated;
select pg_temp.login('00000000-0000-0000-0117-0000000000a1');
insert into public.trips (id, owner_id, title, days) select trip, '00000000-0000-0000-0117-0000000000a1', 'Tip trip', 1 from ids;
insert into public.trip_invites (trip_id, role, token, created_by)
select trip, 'editor', 'tiptoken-edit', '00000000-0000-0000-0117-0000000000a1' from ids;
insert into public.trip_invites (trip_id, role, token, created_by, revoked_at)
select trip, 'viewer', 'tiptoken-old', '00000000-0000-0000-0117-0000000000a1', now() from ids;

select ok(not has_function_privilege('anon', 'public.trip_invite_preview(text)', 'execute'), 'anon cannot preview');
select pg_temp.login('00000000-0000-0000-0117-0000000000a2');
select results_eq($$ select title, role::text from public.trip_invite_preview('tiptoken-edit') $$,
  $$ values ('Tip trip'::text, 'editor'::text) $$, 'title and role of a live invite');
select is((select count(*)::int from public.trip_invite_preview('tiptoken-old')), 0, 'a revoked invite shows nothing');
select is((select count(*)::int from public.trip_invite_preview('nope')), 0, 'an unknown token shows nothing');
select is((select count(*)::int from public.trip_members where user_id = '00000000-0000-0000-0117-0000000000a2'), 0,
  'previewing joins nobody');

select * from finish();
rollback;
