-- Hardening 2026-11, T2-08 (AI-11): planner readiness and leg labels.
-- 1. Each saved stop records where its drive time came from: `road` (the OSRM travel matrix) or `estimate`
--    (straight-line fallback at 35 km/h × 1.4 when the pair is not in the matrix). Old rows stay null (no label).
-- 2. Counts of published places the planner has to guess for, for /admin/planner. Service role only: the page reads
--    it after the admin check, like analytics (T1-11).
alter table public.trip_stops
  add column travel_source text check (travel_source in ('road', 'estimate'));

create function public.planner_readiness()
returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'published', count(*),
    'no_matrix_point', count(*) filter (
      where not exists (select 1 from public.matrix_points mp where mp.entity_id = p.id)),
    'no_hours', count(*) filter (
      where not exists (select 1 from public.place_hours h where h.place_id = p.id and not h.hours_unknown)),
    'no_seasonal', count(*) filter (
      where not exists (select 1 from public.place_seasonal s where s.place_id = p.id)),
    'tide_dependent', count(*) filter (where p.is_tide_dependent),
    'tide_no_rule', count(*) filter (
      where p.is_tide_dependent and not exists (select 1 from public.place_tide_rules r where r.place_id = p.id))
  )
  from public.places p
  where p.status = 'published';
$$;
revoke execute on function public.planner_readiness from public, anon, authenticated;
grant execute on function public.planner_readiness to service_role;
