-- Refinement: foreign keys that queries and RLS filter on keep an index (migration 20261025100000), and no
-- new single-column FK on a user/owner/place/stay/dish/taluka/point column ships without one.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select has_index('public', 'trips', 'trips_owner_id_idx', array['owner_id']);
select has_index('public', 'stays', 'stays_owner_id_idx', array['owner_id']);
select has_index('public', 'eateries', 'eateries_owner_id_idx', array['owner_id']);
select has_index('public', 'push_subscriptions', 'push_subscriptions_user_id_idx', array['user_id']);
select has_index('public', 'ai_actions', 'ai_actions_user_id_idx', array['user_id']);
select has_index('public', 'owner_claims', 'owner_claims_user_id_idx', array['user_id']);
select has_index('public', 'booking_proofs', 'booking_proofs_user_id_idx', array['user_id']);
select has_index('public', 'review_photos', 'review_photos_user_id_idx', array['user_id']);
select has_index('public', 'crowd_typical', 'crowd_typical_place_id_idx', array['place_id']);
select has_index('public', 'place_seasonal', 'place_seasonal_place_id_idx', array['place_id']);
select has_index('public', 'dwell_events', 'dwell_events_place_id_idx', array['place_id']);
select has_index('public', 'verifier_notes', 'verifier_notes_place_id_idx', array['place_id']);
select has_index('public', 'stay_offers', 'stay_offers_stay_id_idx', array['stay_id']);
select has_index('public', 'eatery_dishes', 'eatery_dishes_dish_id_idx', array['dish_id']);
select has_index('public', 'utility_pois', 'utility_pois_taluka_id_idx', array['taluka_id']);
select has_index('public', 'reports', 'reports_qr_code_idx', array['qr_code']);
select has_index('public', 'travel_matrix', 'travel_matrix_to_point_id_idx', array['to_point_id']);

-- Guard: FK columns named user_id / owner_id / place_id / stay_id / dish_id / taluka_id / *_point_id
-- must lead some index.
select is(
  (select coalesce(string_agg(c.conrelid::regclass || '.' || a.attname, ', ' order by 1), '')
   from pg_constraint c
   join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
   where c.contype = 'f' and array_length(c.conkey, 1) = 1 and c.connamespace = 'public'::regnamespace
     and (a.attname in ('user_id', 'owner_id', 'place_id', 'stay_id', 'dish_id', 'taluka_id')
          or a.attname like '%\_point\_id')
     -- small staff-maintained config tables, read whole
     and c.conrelid not in ('public.user_roles'::regclass, 'public.events_calendar'::regclass)
     and not exists (
       select 1 from pg_index i
       where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])),
  '', 'listing / user / taluka foreign keys are indexed');

select * from finish();
rollback;
