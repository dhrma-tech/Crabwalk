-- P7: trip planner inputs/config, visit time + entry fee facts, matrix lookup, published routes.

-- ---------------------------------------------------------------- facts (DECISIONS P7-2, P7-5)
alter table public.places
  add column visit_minutes smallint check (visit_minutes between 10 and 600),
  add column entry_fee_inr integer check (entry_fee_inr >= 0);

-- Visit minutes per category (team tunes); a place's visit_minutes overrides it.
create table public.category_visit_minutes (
  category public.place_category primary key,
  minutes smallint not null check (minutes between 10 and 600),
  updated_at timestamptz
);
insert into public.category_visit_minutes (category, minutes) values
  ('beach', 90), ('fort', 120), ('temple', 45), ('waterfall', 90), ('viewpoint', 30), ('backwater', 90),
  ('cave', 60), ('museum', 60), ('village', 90), ('market', 45), ('orchard', 60);
alter table public.category_visit_minutes enable row level security;
create policy "public read" on public.category_visit_minutes for select using (true);
create policy "admin write" on public.category_visit_minutes for all using (app.is_admin()) with check (app.is_admin());
create trigger set_updated_at before update on public.category_visit_minutes
  for each row execute function app.set_updated_at();

insert into public.app_config (key, value, notes) values
  ('planner_day_start', '"09:00"', 'P7: first stop of each day starts here (IST)'),
  ('planner_daylight', '{"from": "07:00", "to": "18:30"}', 'P7-3: window for places with no/unknown hours'),
  ('fuel_price_inr', 'null', 'P7-6: petrol ₹/L, admin-set; null = user must enter'),
  ('default_mileage_kmpl', 'null', 'P7-6: default vehicle km/L, admin-set'),
  ('heavy_rain_mm_h', '7.6', 'P7: current rain ≥ this deprioritises risky beaches/waterfalls (day of trip = today only)');

-- ---------------------------------------------------------------- trips (P7-9, published routes)
alter table public.trips
  add column start_date date,
  add column diet text check (diet in ('veg', 'non_veg', 'jain')),
  add column slug text unique check (slug ~ '^[a-z0-9-]+$');

-- Approved custom routes are public like ready-made itineraries (PLAN P7 task 10).
create function app.trip_is_public(_trip uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.trips where id = _trip and is_ready_made)
      or exists (select 1 from public.published_routes where trip_id = _trip and status = 'approved');
$$;
create policy "public approved route" on public.trips for select using (app.trip_is_public(id));
create policy "public approved route" on public.trip_stops for select using (app.trip_is_public(trip_id));
create policy "public approved route" on public.trip_budget for select using (app.trip_is_public(trip_id));

-- Reviewers set reviewed_by to themselves; owners may re-submit a rejected route.
create policy "own resubmit" on public.published_routes for update
  using (app.owns_trip(trip_id) and status = 'rejected')
  with check (app.owns_trip(trip_id) and status = 'pending_review' and reviewed_by is null);

-- Share-page vote tally (owner sees names via RLS; guests see counts only).
create function public.trip_vote_counts(_token text)
returns table (entity_id uuid, up integer, down integer)
language sql stable security definer set search_path = '' as $$
  select v.entity_id, count(*) filter (where v.vote = 'up')::int, count(*) filter (where v.vote = 'down')::int
  from public.group_votes v join public.trips t on t.id = v.trip_id
  where t.share_token = _token
  group by v.entity_id;
$$;
grant execute on function public.trip_vote_counts(text) to anon, authenticated;

-- ---------------------------------------------------------------- planner data
-- Corrected road time/distance between listed entities, as one JSON row (avoids PostgREST row caps).
create function public.planner_matrix(_ids uuid[])
returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_array(a.entity_id, b.entity_id, tm.duration_corrected_s, tm.distance_m)), '[]'::jsonb)
  from public.travel_matrix tm
  join public.matrix_points a on a.id = tm.from_point_id
  join public.matrix_points b on b.id = tm.to_point_id
  where a.entity_id = any(_ids) and b.entity_id = any(_ids);
$$;

-- Places with an active danger alert within 1 km (BACKEND §10.2 step 2).
create function public.planner_alerted_places(_ids uuid[])
returns setof uuid
language sql stable security invoker set search_path = '' as $$
  select p.id from public.places p
  where p.id = any(_ids) and exists (
    select 1 from public.alerts a
    where a.severity = 'danger' and a.expires_at > now()
      and extensions.st_dwithin(a.geometry, p.location, 1000)
  );
$$;

-- Reviewers read a submitted route (stops included) without RLS access to the owner's trip.
create function public.get_route_for_review(_trip uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'trip', to_jsonb(t) - 'owner_id' - 'share_token',
    'stops', coalesce((select jsonb_agg(to_jsonb(s) order by s.day, s."order")
                       from public.trip_stops s where s.trip_id = t.id), '[]'::jsonb)
  )
  from public.trips t
  join public.published_routes r on r.trip_id = t.id
  where t.id = _trip and (app.has_role('reviewer') or app.is_admin());
$$;
revoke execute on function public.get_route_for_review from anon;
