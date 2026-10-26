-- Discover (phase-10b, DECISIONS T-24): "Today on the coast" and grouped search.

-- Each region names the weather point Discover shows before the visitor shares a location (T-9). Region lives in
-- data: more regions = more rows. The tide station is derived (nearest to this point), so it needs no column.
alter table public.regions
  add column default_weather_point_id uuid references public.weather_points (id) on delete set null;
create index regions_default_weather_point_id_idx on public.regions (default_weather_point_id);

update public.regions r
set default_weather_point_id = (select w.id from public.weather_points w where w.name = 'Ratnagiri')
where r.name = 'Ratnagiri';

-- Search (Report 1 §4.2): dishes join places/stays/eateries, at most 5 per kind so every group fills. Columns are
-- unchanged; dishes have no location (lon/lat null), so the map skips them.
create or replace function public.map_search(q text)
returns table (kind text, slug text, name text, lang text, lon float8, lat float8)
language sql stable security invoker set search_path = '' as $$
  select r.kind, r.slug, r.name, r.lang, r.lon, r.lat from (
    select h.*, row_number() over (partition by h.kind order by h.name) as n from (
      select 'place' as kind, p.slug, t.name, t.lang::text as lang,
        extensions.st_x(p.location::extensions.geometry) as lon, extensions.st_y(p.location::extensions.geometry) as lat
      from public.place_translations t join public.places p on p.id = t.place_id
      where p.status = 'published' and t.name ilike '%' || q || '%'
      union all
      select 'stay', s.slug, t.name, t.lang::text,
        extensions.st_x(s.location::extensions.geometry), extensions.st_y(s.location::extensions.geometry)
      from public.stay_translations t join public.stays s on s.id = t.stay_id
      where s.status = 'published' and t.name ilike '%' || q || '%'
      union all
      select 'eatery', e.slug, t.name, t.lang::text,
        extensions.st_x(e.location::extensions.geometry), extensions.st_y(e.location::extensions.geometry)
      from public.eatery_translations t join public.eateries e on e.id = t.eatery_id
      where e.status = 'published' and t.name ilike '%' || q || '%'
      union all
      select 'dish', d.slug, t.name, t.lang::text, null, null
      from public.dish_translations t join public.dishes d on d.id = t.dish_id
      where t.name ilike '%' || q || '%'
    ) h
  ) r
  where length(q) >= 2 and r.n <= 5
  order by array_position(array['place', 'stay', 'eatery', 'dish'], r.kind), r.n;
$$;
