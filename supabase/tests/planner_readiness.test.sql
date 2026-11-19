-- T2-08: drive-time source on stops; readiness counts for /admin/planner (service role only).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select has_column('public', 'trip_stops', 'travel_source', 'stops record the drive-time source');
select throws_ok(
  $$ insert into public.trip_stops (trip_id, day, "order", entity_type, entity_id, kind, travel_source)
     values (gen_random_uuid(), 1, 0, 'place', gen_random_uuid(), 'place', 'guess') $$,
  '23514', null, 'only road or estimate');

select ok(not has_function_privilege('anon', 'public.planner_readiness()', 'execute'), 'anon cannot read readiness');
select ok(not has_function_privilege('authenticated', 'public.planner_readiness()', 'execute'), 'users cannot read readiness');
select ok(has_function_privilege('service_role', 'public.planner_readiness()', 'execute'), 'the server can');

create temp table before as select public.planner_readiness() as r;
do $$
declare t uuid := (select id from public.talukas where name_en = 'Ratnagiri');
begin
  -- A published place with nothing: no matrix point, no hours, no seasonal row; tide-dependent without a rule.
  insert into public.places (slug, category, taluka_id, location, status, is_tide_dependent)
  values ('pr-bare', 'beach', t, 'SRID=4326;POINT(73.3 17.0)', 'published', true);
  -- A draft never counts.
  insert into public.places (slug, category, taluka_id, location, status, is_tide_dependent)
  values ('pr-draft', 'beach', t, 'SRID=4326;POINT(73.3 17.0)', 'draft', true);
end;
$$;
create temp table after as select public.planner_readiness() as r;

select is((select (a.r->>'published')::int - (b.r->>'published')::int from after a, before b), 1, 'published +1, drafts not counted');
select is((select (a.r->>'no_matrix_point')::int - (b.r->>'no_matrix_point')::int from after a, before b), 1, 'no matrix point +1');
select is((select (a.r->>'no_hours')::int - (b.r->>'no_hours')::int from after a, before b), 1, 'no hours +1');
select is((select (a.r->>'no_seasonal')::int - (b.r->>'no_seasonal')::int from after a, before b), 1, 'no seasonal row +1');
select is((select (a.r->>'tide_no_rule')::int - (b.r->>'tide_no_rule')::int from after a, before b), 1, 'tide-dependent without a rule +1');

insert into public.place_hours (place_id, weekday, opens, closes, hours_unknown)
select id, 1, '09:00', '17:00', false from public.places where slug = 'pr-bare';
insert into public.place_tide_rules (place_id, max_safe_height_m)
select id, 1.0 from public.places where slug = 'pr-bare';
select is((public.planner_readiness()->>'no_hours')::int, (select (b.r->>'no_hours')::int from before b), 'known hours clear the gap');
select is((public.planner_readiness()->>'tide_no_rule')::int, (select (b.r->>'tide_no_rule')::int from before b), 'a tide rule clears the gap');

select * from finish();
rollback;
