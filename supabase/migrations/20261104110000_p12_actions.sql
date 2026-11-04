-- P12: Crabby's confirm-first previews (product plan 10.11). Auto actions (open a page, filters, map, workspace
-- sections) never touch the DB; anything that changes data, posts for others or leaves the site stays an
-- ai_actions preview the user applies: add to a trip day or list (10.11, 10.6), ask our team (10.1), send a stay
-- request (10.2), share a card in the trip's group chat (10.8).
alter table public.ai_actions drop constraint ai_actions_type_check;
alter table public.ai_actions add constraint ai_actions_type_check check (type in (
  'create_plan', 'edit_plan', 'open_map', 'start_nav', 'shortlist_stays', 'save_share',
  'add_to_trip', 'add_to_list', 'ask_team', 'send_request', 'share_to_chat'
));

-- "Ask, don't assume" (product plan §4): when a plan has no start point, Crabby asks with these suggestions
-- (names of utility_pois railway stations / bus stands; region data, not code). "Other" takes any station.
insert into public.app_config (key, value, notes) values
  ('plan_start_suggestions', '["Ratnagiri", "Ratnagiri Bus Depot", "Chiplun", "Khed"]',
   'Start points offered on Crabby''s plan question card (P12 step C)')
on conflict (key) do nothing;
