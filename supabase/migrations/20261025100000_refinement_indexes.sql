-- Refinement (AUDIT.md "DB"): indexes for foreign keys that queries and RLS policies filter on.
-- Postgres does not index FK columns by itself; without these, "my trips/claims/proofs", RLS checks on
-- user_id/owner_id and per-place lookups scan the whole table as data grows.

-- Owner / user lookups (also used by RLS policies: owner_id = auth.uid(), user_id = auth.uid()).
create index if not exists trips_owner_id_idx on public.trips (owner_id);
create index if not exists stays_owner_id_idx on public.stays (owner_id);
create index if not exists eateries_owner_id_idx on public.eateries (owner_id);
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
create index if not exists ai_actions_user_id_idx on public.ai_actions (user_id);
create index if not exists owner_claims_user_id_idx on public.owner_claims (user_id);
create index if not exists booking_proofs_user_id_idx on public.booking_proofs (user_id);
create index if not exists review_photos_user_id_idx on public.review_photos (user_id);

-- Per-listing lookups on place / stay / dish pages, the planner and pattern analysis.
create index if not exists crowd_typical_place_id_idx on public.crowd_typical (place_id);
create index if not exists place_seasonal_place_id_idx on public.place_seasonal (place_id);
create index if not exists dwell_events_place_id_idx on public.dwell_events (place_id);
create index if not exists verifier_notes_place_id_idx on public.verifier_notes (place_id);
create index if not exists stay_offers_stay_id_idx on public.stay_offers (stay_id);
create index if not exists eatery_dishes_dish_id_idx on public.eatery_dishes (dish_id);

-- Taluka packs, QR report triage, and route cleanup when a matrix point is removed.
create index if not exists utility_pois_taluka_id_idx on public.utility_pois (taluka_id);
create index if not exists reports_qr_code_idx on public.reports (qr_code);
create index if not exists travel_matrix_to_point_id_idx on public.travel_matrix (to_point_id);
