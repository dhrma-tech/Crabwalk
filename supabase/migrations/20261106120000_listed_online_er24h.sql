-- Desk import, open items (user 2026-11-05).
-- Q10: a stay price found online (OTA page or the stay's own site) and not confirmed by the owner. `owner` stays
-- for owner-confirmed prices only.
alter type public.price_source add value if not exists 'listed_online';

-- Q13: a hospital's 24 h emergency service; null = unknown. Filled only after the team has called each hospital
-- (until then the desk values sit in import_audit); the emergency card doesn't read it.
alter table public.utility_pois add column emergency_24h boolean;
