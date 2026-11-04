-- P12 step G: trip group chat (product plan 10.8). Crabby merges the tripmates' profiles as GROUP TOTALS only —
-- how many are veg / Jain, skip seafood, prefer which pace, like which kinds of places — from the quiz answers of
-- members who keep that source on; never one person's answers (DPDPA; P12 plan §6).
-- The no-login group vote link is retired (DECISIONS P12-0): its write path is closed; old votes stay as data.
create function public.trip_group_profile(_trip uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with m as (
    select p.diet, p.seafood, p.pace, p.interests, p.budget_band
    from public.trip_members tm join public.user_profile p on p.user_id = tm.user_id
    where tm.trip_id = _trip and p.use_quiz
  )
  select case when app.is_trip_member(_trip) then jsonb_build_object(
    'tripmates', (select count(*) from public.trip_members where trip_id = _trip),
    'with_profile', (select count(*) from m),
    'diet', (select coalesce(jsonb_object_agg(diet, n), '{}') from
              (select diet, count(*) n from m where diet is not null group by diet) d),
    'no_seafood', (select count(*) from m where seafood = false),
    'pace', (select coalesce(jsonb_object_agg(pace, n), '{}') from
              (select pace, count(*) n from m where pace is not null group by pace) x),
    'interests', (select coalesce(jsonb_object_agg(c, n), '{}') from
              (select unnest(interests) c, count(*) n from m group by 1) i),
    'budget', (select coalesce(jsonb_object_agg(budget_band, n), '{}') from
              (select budget_band, count(*) n from m where budget_band is not null group by 1) b)
  ) end;
$$;
revoke execute on function public.trip_group_profile(uuid) from public, anon;
grant execute on function public.trip_group_profile(uuid) to authenticated;

revoke execute on function public.cast_group_vote(text, text, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.trip_vote_counts(text) from public, anon, authenticated;
