-- Hardening 2026-11, T2-04 (AI-04, AI Spec 5.5): attribute search over published places for Crabby.
-- No `_tags`: places have no tag vocabulary yet (vocab.ts has stay vibes, amenities and diets only), and the brief
-- says not to invent one. Owner decision 2026-11-19: ship without tags; add `_tags` with a tag column later.
-- Category, monsoon, taluka, hidden gem, tide-free and radius are hard filters (what the traveller asked for, and
-- the safety-relevant ones must never be traded away for score). Crowd is a preference: calm places score higher,
-- since crowd data is sparse and a hard filter would hide most places. `matched` names what each row matched;
-- `score` counts it. Security invoker: runs with the caller's RLS, like every Crabby tool.
create function public.find_places(
  _categories public.place_category[] default null,
  _crowd text default null,
  _monsoon_ok boolean default null,
  _taluka text default null,
  _near_slug text default null,
  _max_km numeric default null,
  _hidden_gem boolean default null,
  _tide_free boolean default null,
  _weekday smallint default null,
  _limit integer default 6
)
returns table (
  slug text, name_en text, name_hi text, name_mr text, category public.place_category, taluka text,
  km numeric, matched text[], score integer
)
language sql stable security invoker set search_path = '' as $$
  with origin as (
    select p.location from public.places p where p.slug = _near_slug and p.status = 'published'
  ),
  wd as (
    select coalesce(_weekday, extract(dow from now() at time zone 'Asia/Kolkata')::smallint) as d
  ),
  hits as (
    select p.id, p.slug, p.category, t.name_en as taluka,
      case when _near_slug is not null then
        round((extensions.st_distance(p.location, (select location from origin)) / 1000)::numeric, 1)
      end as km,
      array_remove(array[
        case when _categories is not null then 'category' end,
        case when _crowd = 'calm' and exists (
          select 1 from public.crowd_typical c, wd
          where c.place_id = p.id and c.weekday = wd.d and c.level in ('calm', 'empty')
        ) then 'crowd:calm' end,
        case when _monsoon_ok then 'monsoon:open' end,
        case when _near_slug is not null then 'near' end,
        case when _hidden_gem then 'hidden_gem' end,
        case when _tide_free then 'tide_free' end
      ], null) as matched
    from public.places p
    join public.talukas t on t.id = p.taluka_id
    where p.status = 'published'
      and (_categories is null or p.category = any (_categories))
      and (_monsoon_ok is not true or p.monsoon_status = 'open')
      and (_taluka is null or t.name_en ilike _taluka)
      and (_hidden_gem is not true or p.is_hidden_gem)
      and (_tide_free is not true or not p.is_tide_dependent)
      and (_near_slug is null or (
        p.slug <> _near_slug
        and extensions.st_dwithin(p.location, (select location from origin), least(coalesce(_max_km, 25), 100) * 1000)
      ))
  )
  select h.slug,
    (select tr.name from public.place_translations tr where tr.place_id = h.id and tr.lang = 'en'),
    (select tr.name from public.place_translations tr where tr.place_id = h.id and tr.lang = 'hi'),
    (select tr.name from public.place_translations tr where tr.place_id = h.id and tr.lang = 'mr'),
    h.category, h.taluka, h.km, h.matched, cardinality(h.matched)
  from hits h
  order by cardinality(h.matched) desc, h.km nulls last,
    (select tr.name from public.place_translations tr where tr.place_id = h.id and tr.lang = 'en'), h.slug
  limit least(greatest(coalesce(_limit, 6), 1), 8);
$$;
revoke execute on function public.find_places from public;
grant execute on function public.find_places to anon, authenticated, service_role;
