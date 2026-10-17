# CRABWALK — BACKEND SPEC (Prompt for Claude Code)

> Execution order lives in `CRABWALK_PLAN.md`. This file defines WHAT to build on the server side.
> Tags: `[LOCKED]` = from locked plan, do not change. `[DEFAULT]` = implementation default, overridable in Phase 0. `[OPEN]` = undecided — ask the user before building.
> Phase markers (P0…P10) say when each part is built.

---

## 1. PRINCIPLES (enforce in code review of every PR)

1. **AI firewall** `[LOCKED]` — Ola Maps data never reaches any AI/LLM code. Ola lives in an isolated service with its own key. AI service has no Ola env var and no import path to it.
2. **LLM never invents** `[LOCKED]` — LLM only parses intent, calls our tools, explains results. All facts come from our DB.
3. **₹0** `[LOCKED]` — free tiers only. No card-required services.
4. **Own data first** — our DB is searched before any external API.
5. **Honest data** — every crowd/heatmap value carries `source: 'live' | 'typical'`. Every place carries `last_verified_at`.
6. **Sponsorship isolation** `[LOCKED]` — sponsor fields are never read by ranking, rating aggregation, recommendation, or AI tools.
7. **Privacy** `[LOCKED]` — no phone numbers or live-location history sent to free-tier LLMs; dwell-time collection only with explicit opt-in, anonymized, DPDPA-compliant.

---

## 2. STACK

| Concern | Choice | Status |
|---|---|---|
| Database | Supabase Postgres (free tier) | `[LOCKED]` (matrix + pgvector in Supabase) |
| Vector search | pgvector | `[LOCKED]` |
| Geo queries | PostGIS | `[DEFAULT]` |
| Auth | Supabase Auth; method per gate G4 | `[DEFAULT]` provider / `[OPEN]` method |
| Server functions + crons | per gate G2 (Supabase Edge Functions + pg_cron, or Vercel functions + cron) | `[OPEN]` |
| File storage (photos, audio) | Supabase Storage | `[DEFAULT]` |
| Tile hosting | PMTiles on Vercel or Cloudflare (gate G3) | `[LOCKED]` options / `[OPEN]` pick |
| Routing engine | OSRM, run once on laptop | `[LOCKED]` |
| Push | Web Push (VAPID) | `[DEFAULT]` (plan locks "web push") |
| Language | TypeScript for services; Python or Node for laptop pipelines | `[DEFAULT]` |

---

## 3. DATABASE SCHEMA (P1 — create all tables in P1)

Conventions: `id uuid pk default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at timestamptz`. Geo columns `geography(Point,4326)`. Every content table has `is_seed boolean default false` (dev-only rows, excluded in prod).

### 3.1 Users and roles
- **profiles**: `id` (= auth user id), `display_name`, `role` enum(`user`,`verifier`,`reviewer`,`owner`,`admin`), `language` enum(`en`,`hi`,`mr`), `theme` enum(`system`,`light`,`dark`)
- **user_preferences** `[LOCKED: preferences-only memory]`: `user_id`, `diet` (veg/non-veg/jain), `budget_level`, `group_type` enum(`family`,`couple`,`solo`,`friends`), `past_trip_ids uuid[]`
- **consents**: `user_id`, `type` enum(`dwell_time`,`push`,`ai_processing`), `granted bool`, `granted_at`, `revoked_at`
- **verifier_talukas**: `user_id`, `taluka_id` (one verifier owns one taluka)

### 3.2 Geography
- **talukas**: `id`, `name_en`, `name_hi`, `name_mr`, `boundary geography(MultiPolygon)`, `pack_url`, `pack_version` — 9 rows for Ratnagiri district
- **matrix_points**: `id`, `entity_type` enum(`place`,`stay`,`eatery`), `entity_id`, `location`
- **travel_matrix** `[LOCKED]`: `from_point_id`, `to_point_id`, `duration_s` (raw), `distance_m`, `duration_corrected_s`, `route_shape` (encoded polyline), `computed_at`; pk (`from_point_id`,`to_point_id`)
- **correction_factors** `[OPEN values, LOCKED existence]`: `id`, `type` enum(`ghat`,`coastal`,`monsoon`), `multiplier numeric`, `active_months int[]` (for monsoon), `notes`
- **road_segments_flags**: OSM way id → flag (`ghat`,`coastal`) used by the pipeline to apply factors

### 3.3 Places (Discover)
- **places**: `id`, `slug`, `category` enum(`beach`,`fort`,`temple`,`waterfall`,`viewpoint`,`backwater`,`cave`,`museum`,`village`,`market`,`orchard`), `taluka_id`, `location`, `entry_fee_text`, `best_time_text`, `how_to_reach_text`, `nearest_station_text`, `nearest_bus_stop_text`, `is_hidden_gem bool` (verifier only), `is_tide_dependent bool`, `tide_station_id`, `monsoon_status` enum(`open`,`risky`,`closed`), `monsoon_reason`, `food_delivery jsonb` (per app: available bool + deep link), `status` enum(`draft`,`in_review`,`published`), `last_verified_at`, `next_recheck_at`
- **place_translations**: `place_id`, `lang`, `name`, `short_story`, `history`, `significance`, `dos`, `donts`, `safety_text`, `approved_by`, `approved_at`
- **place_hours**: `place_id`, `weekday`, `opens`, `closes`, `hours_unknown bool`
- **place_seasonal**: `place_id`, `season` enum(`turtle_nesting`,`mango`,`firefly`,`waterfall`), `from_month`, `to_month`
- **crowd_typical**: `place_id`, `weekday`, `season`, `level` enum(`empty`,`calm`,`busy`) — set by verifier
- **photos**: `id`, `entity_type`, `entity_id`, `storage_path`, `lqip`, `width`, `height`, `uploaded_by` (verifier/owner), `is_hero bool` — verifier/owner-shot only `[LOCKED]`
- **audio_guides**: `place_id`, `lang`, `storage_path`, `duration_s` (1–5 min), `transcript`, `source` enum(`tts`,`recorded`)
- **place_embeddings**: `place_id`, `embedding vector(<dim from G7>)`
- **verifier_notes**: raw field notes per place (input to AI drafting; kept internal as source notes)

### 3.4 Stays
- **stays**: `id`, `slug`, `taluka_id`, `location`, `vibe_tags text[]` from enum (`traditional_konkani_home`,`family`,`luxury`,`business`,`backpacker`,`couple_friendly`,`pet_friendly`,`beachfront`,`orchard_stay`), `service_style` enum(`homely`,`professional`), `amenities jsonb` (ac, hot_water, wifi, parking, power_backup), `network_strength jsonb` (per operator), `food_at_stay jsonb` (veg, non_veg, malvani, jain, homemade_included), `price_min`, `price_max`, `price_source` enum(`owner`,`agoda`,`affiliate`), `phone`, `whatsapp`, `is_verified bool` (team visited), `owner_id`, `claimed_at`, `status`, `last_verified_at`
- **stay_translations**: `stay_id`, `lang`, `name`, `description`
- **stay_offers** (price comparison rows): `stay_id`, `provider` (`agoda`,`makemytrip`,`booking_com`,…), `deep_link`, `affiliate_network` (`agoda_partners`,`inrdeals`,`cuelinks`), `live_price`, `fetched_at`

### 3.5 Eateries and dishes
- **eateries**: `id`, `slug`, `taluka_id`, `location`, `authenticity` enum(`home_style`,`local_legend`,`tourist_oriented`), `price_for_two`, `diet_flags` (veg, non_veg, jain), `vibe_tags`, `service_style`, `food_apps jsonb` (swiggy, zomato, eatsure, magicpin, …: available + deep link — verifier marked), `menu jsonb`, `owner_id`, `is_verified`, `status`, `last_verified_at`
- **eatery_translations**: `eatery_id`, `lang`, `name`, `description`
- **eatery_hours**: same shape as `place_hours`
- **dishes**: `id`, `slug` (solkadhi, kombdi_vade, bangda_fry, surmai_thali, modak, ghavane, aamras, kokum_sherbet, …)
- **dish_translations**: `dish_id`, `lang`, `name`, `what_it_is`, `story`
- **eatery_dishes**: `eatery_id`, `dish_id`, `is_signature bool`, `is_best_for bool`

### 3.6 Ratings and reviews (P5)
- **verdicts**: `user_id`, `entity_type` enum(`place`,`stay`,`eatery`), `entity_id`, `group_type`, `level smallint check 1..4`, unique(`user_id`,`entity_type`,`entity_id`,`group_type`)
- **sub_scores**: `user_id`, `entity_type`, `entity_id`, `dimension` enum(`taste`,`authenticity`,`hygiene`,`value`,`cleanliness`,`host`,`location`), `score smallint 0..5`, unique per user/entity/dimension
- **reviews**: `id`, `user_id`, `entity_type`, `entity_id`, `group_type`, `text`, `photo_ids uuid[]`, `moderation_status` enum(`pending`,`approved`,`rejected`)
- **review_summaries**: `entity_type`, `entity_id`, `lang`, `summary`, `generated_at` (nightly)
- **verified_visits**: `user_id`, `entity_type`, `entity_id`, `method` enum(`qr_gps`,`booking_proof`), `distance_m`, `created_at`
- **verdict_agg** (materialized view or table refreshed on write): `entity_type`, `entity_id`, `group_type`, `counts int[4]`, `total`, `winner_level`, `winner_pct`, `is_new` (= total < 10)

### 3.7 QR (P6)
- **qr_codes**: `code` (e.g. `RTN-001`, unique), `entity_type` enum(`place`,`stay`,`eatery`,`station`,`bus_stand`), `entity_id`, `sponsor_id`, `installed_at`, `permission_status` enum(`pending`,`granted`) + `permission_body` (ASI/state archaeology, temple trust, gram panchayat)
- **qr_scans**: `code`, `scanned_at`, `lang`, `session_hash` (no user id needed), `lat`/`lng` nullable (only if user allowed)
- **sponsors**: `id`, `name`, `entity_type`, `entity_id` (nearby stay/eatery) — display only
- **reports**: `id`, `entity_type`, `entity_id`, `qr_code`, `type` enum(`broken_qr`,`garbage`,`unsafe_spot`,`wrong_info`), `text`, `photo_id`, `status` enum(`new`,`triaged`,`fixed`,`rejected`), `assigned_to`

### 3.8 Context data (P3)
- **weather_points**: ~20 Ratnagiri points (`id`, `name`, `location`)
- **weather_cache**: `point_id`, `fetched_at`, `payload jsonb`, `summary` (rain, temp, wind)
- **tide_stations**: coastal stations (`id`, `name`, `location`, `provider_station_id`)
- **tide_cache**: `station_id`, `date`, `extremes jsonb` (high/low times + heights), `curve jsonb`, `provider` enum(`tidesatlas`,`tidecheck`), `fetched_at`
- **place_tide_rules**: `place_id`, `max_safe_height_m` or rule text — `[OPEN]` exact accessibility rule per spot comes from verifiers
- **events_calendar**: `id`, `name_*`, `type` (festival, jatra, season), `from_date`, `to_date`, `taluka_id` nullable, `impact` (crowd, closures)
- **alerts**: `id`, `type` enum(`road_condition`,`ghat`,`landslide`,`closure`), `geometry`, `severity` enum(`caution`,`danger`), `reason_*`, `source` enum(`verifier`,`user_report`,`team_news`), `reported_at`, `expires_at` (TTL per G9), `confirmed_at`
- **utility_pois**: `id`, `type` enum(`fuel`,`atm`,`hospital`,`pharmacy`,`police`,`toilet`,`ev_charger`,`mechanic`,`bus_stand`,`railway_station`,`ferry_jetty`), `location`, `name`, `osm_id`, `source` enum(`osm`,`verifier`), `phone` (hospitals for emergency card), `taluka_id`
- **trails**: `id`, `name_*`, `gpx_storage_path`, `geometry`, `source` enum(`osm_verified`,`team_recorded`), `difficulty` `[OPEN]` scale

### 3.9 Trips (P7)
- **trips**: `id`, `owner_id`, `title`, `days`, `start_point`, `budget`, `group_type`, `interests text[]`, `pace` enum `[OPEN values — DEFAULT: relaxed, balanced, packed]`, `standout bool`, `share_token`, `status` enum(`draft`,`saved`,`completed`), `is_ready_made bool`
- **trip_stops**: `trip_id`, `day`, `order`, `entity_type`, `entity_id`, `arrive_at`, `depart_at`, `travel_from_prev_s`, `reason_*` (short per-stop reason), `kind` enum(`place`,`stay`,`meal`)
- **trip_budget**: `trip_id`, `stay`, `food`, `fuel`, `entry`, `activities`, `vehicle_mileage_kmpl`, `fuel_price`, `people`
- **group_votes**: `trip_id`, `voter_token` (guest, no login), `voter_name`, `entity_id`, `vote` (up/down `[DEFAULT]`)
- **published_routes**: `trip_id`, `status` enum(`pending_review`,`approved`,`rejected`), `reviewed_by`
- **dwell_events** (opt-in only): `anon_id`, `place_id`, `arrived_at`, `left_at` — no user id stored
- **route_stats**: aggregated trending/underrated routes (analytics, no LLM)

### 3.10 AI (P8)
- **ai_usage**: `user_id`, `date`, `message_count` — cap ~20/day `[LOCKED]`
- **ai_actions**: `id`, `user_id`, `type` (create_plan, edit_plan, open_map, start_nav, shortlist_stays, save_share), `preview jsonb`, `status` enum(`proposed`,`applied`,`discarded`)
- **content_drafts**: `entity_type`, `entity_id`, `lang`, `field`, `draft_text`, `status` enum(`draft`,`approved`,`rejected`), `reviewer_id`

---

## 4. ROW-LEVEL SECURITY (P1)

| Table group | anon | user | verifier | reviewer | owner | admin |
|---|---|---|---|---|---|---|
| published places/stays/eateries/dishes + translations | read | read | read/write in own taluka (draft) | approve/publish | edit own listing **fact fields only** | all |
| verdicts / sub_scores | read agg only | write own | write own | write own | write own (not on own listing) `[DEFAULT]` | all |
| sub_scores `hygiene` / `cleanliness` | — | write only if row in `verified_visits` for that entity | same | same | same | all |
| reviews | read approved | write own | — | moderate | read | all |
| reports | insert | insert | read/update own taluka | read | — | all |
| trips | read via `share_token` | CRUD own | — | — | — | all |
| group_votes | insert with valid `share_token` (no login) | insert | — | — | — | all |
| ai_usage / ai_actions | — | read own | — | — | — | all |
| dwell_events | — | insert only if consent row granted | — | — | — | aggregate read |
| sponsors | read name only | read | — | — | — | all |

Owner fact fields `[LOCKED]`: photos, prices, menu, timings, contact. Owners can NEVER write `verdicts`, `sub_scores`, `reviews`, `verdict_agg`, `is_verified`, `is_hidden_gem`.

Write SQL tests for every row of this table.

---

## 5. RATING ENGINE (P5) `[LOCKED]`

- Levels 1–4. Labels by entity type (UI maps them):
  - place: 1 Skip · 2 Timepass · 3 Worth it · 4 Must visit
  - stay: 1 Avoid · 2 Okay · 3 Good stay · 4 Perfect stay
  - eatery: 1 Skip · 2 Okay · 3 Go for it · 4 Local legend
- Separate aggregate per `group_type`. Also compute an "all" aggregate `[DEFAULT]` for cards.
- Output: `winner_level`, `winner_pct = max(count)/total`, `total`, `counts[4]`, `is_new = total < 10`.
- Tie on winner `[OPEN]` — DEFAULT: higher level wins; log in DECISIONS.md.
- Sub-scores: food (taste, authenticity, hygiene, value); stays (cleanliness, value, host, location). Average per dimension, 0–5.
- Hygiene (food) and cleanliness (stays) accepted only if `verified_visits` exists for (user, entity) via `qr_gps` (GPS within ~200 m) or `booking_proof` (method per G6).
- Voters: any logged-in user.
- Reviews: verdict + optional text/photos; moderation via small fast model (P8); nightly AI summary per entity per language.
- "TBD rating": parked — do NOT build.

---

## 6. MAP & NAVIGATION BACKEND (P3, P9) `[LOCKED]`

| Job | Source |
|---|---|
| Map display + offline | MapLibre + self-hosted Ratnagiri OSM PMTiles (Protomaps) |
| AI planner, pattern analysis, live trip, estimator | Own `travel_matrix` |
| Planned-trip navigation | Stored OSRM `route_shape` (works offline) |
| Navigation to places not in DB | Ola Directions via `ola-proxy` (display only) |
| Address search for places not in DB | Ola Autocomplete via `ola-proxy` (debounced); own DB searched first |
| Long highway drives | "Open in Google Maps" link (client) |

### 6.1 `ola-proxy` service (isolated)
- Own deployment unit, own secret `OLA_API_KEY`. No other service has this variable.
- Endpoints: `GET /ola/autocomplete?q=` , `GET /ola/directions?from=&to=`.
- **No server-side caching** of Ola responses (not in DB, not in shared CDN cache — set `Cache-Control: private, no-store` on server; client stores in its own PWA cache only). Pending: written confirmation from support@olakrutrim.com on per-user route caching — until confirmed, client cache is limited to the active session `[DEFAULT]`.
- Never write Ola results to any table.
- Response includes attribution flag so the UI shows "Ola Maps" linked to openstreetmap.org/copyright.
- Rate-limit per user to protect free tier (100K calls/API/month).
- Do NOT call Ola tiles endpoints.
- Lint rule / CI check: fail build if any file under `services/api/ai/**` imports from `services/ola-proxy/**` or references `OLA_`.

### 6.2 OSM licence
- "© OpenStreetMap contributors" on map. Matrix used inside the app only (not published).

---

## 7. LAPTOP PIPELINES (P3, re-runnable) — `pipelines/`

Each pipeline: README with exact commands, idempotent, writes a run log.

1. **osm-extract**: download Ratnagiri-region extract from Geofabrik (Maharashtra/India extract, then clip to Ratnagiri district boundary).
2. **tiles**: build PMTiles with Protomaps tooling for the district + one pack per taluka (9). Output to host from G3. Version string per pack.
3. **osrm-matrix**:
   - Build OSRM car profile from the extract.
   - Read `matrix_points` from Supabase (~300 points).
   - Compute all-pairs duration, distance, route geometry.
   - Apply `correction_factors` by flagged segments (ghat, coastal) and month (monsoon) → `duration_corrected_s`. Values come from DB config (G8), not hard-coded.
   - Upsert into `travel_matrix`. Re-run when places are added (incremental: only new pairs).
4. **utility-pois**: extract OSM features for the 11 utility types → `utility_pois` (source `osm`). Verifier corrections stored as `source = verifier`; fixes go back into OSM by team (survey-only rule).
5. **trails**: import OSM trails + team GPX → `trails`.
6. **embeddings** (P8): run multilingual model (G7) on place text (all 3 languages) → `place_embeddings`.

---

## 8. CONTEXT CRONS (P3)

| Job | Schedule | Rule |
|---|---|---|
| Weather | hourly | OpenWeatherMap free tier; fetch ~20 `weather_points`; store `weather_cache`; stay within ~1,000 calls/day |
| Tides | daily | TidesAtlas per coastal station (CC BY 4.0, attribution required); fallback TideCheck (50 req/day, 37 days ahead) via env switch `TIDE_PROVIDER` |
| Alerts expiry | hourly | mark expired where `expires_at < now()` and not re-confirmed |
| Re-check queue | daily | set `next_recheck_at` monthly; user reports trigger immediate recheck flag |
| Review summaries | nightly | batch LLM (P8) |
| Verdict agg refresh | on write or every 5 min `[DEFAULT]` | |
| Route stats | nightly | trending/underrated from saved & completed trips |

- **Do not use Open-Meteo** `[LOCKED]` (non-commercial free tier).
- Read provider docs for exact endpoints before coding; never guess an endpoint.

---

## 9. QR BACKEND (P6) `[LOCKED]`

- `GET /q/:code` → resolve `qr_codes` → serve standalone scan page (from `apps/qr`) with entity data inlined (single request where possible).
- Scan page data payload: name, hero photo (small), audio guide URLs (3 langs), story/history, do's/don'ts, safety/status (monsoon, tide, alerts), Near me now (nearest stays, food, fuel, ATM, toilets, hospital, next spots with distance — computed via PostGIS + matrix), sponsor name.
- Payload must keep total page < 100 KB.
- `POST /q/:code/visit` with `{lat,lng}` → if logged in and distance ≤ ~200 m → insert `verified_visits`. Server computes distance; never trust client distance.
- `POST /q/:code/report` → `reports` (anon allowed, rate-limited).
- `POST /q/:code/scan` → `qr_scans` (feeds live crowd + heatmap).
- Station/bus-stand codes resolve to "Start your Konkan trip" landing.
- Stay/eatery codes resolve to menu + reviews + leave-review (no pay).
- Plaque sheet generator: printable PDF/SVG per code: place name, QR → short URL, "112", short URL text.

---

## 10. TRIP PLANNER (P7) `[LOCKED behaviour, DEFAULT algorithm]`

### 10.1 Inputs
days, start point, budget, group type, interests (categories), pace, standout toggle, optional diet.

### 10.2 Deterministic algorithm `[DEFAULT]`
1. Candidate set: published places matching interests (+ hidden gems & calm/empty crowd boosted when `standout = true`).
2. Filter out: `monsoon_status = closed` (risky → allowed with warning), places closed on that weekday, active `danger` alerts on route.
3. Daily time window from pace (DEFAULT hours: relaxed 6, balanced 8, packed 10 — `[OPEN]` confirm).
4. Greedy insertion + 2-opt reorder using `duration_corrected_s` (minimize backtracking).
5. Constraints: arrive within opening hours; tide-dependent spots only inside safe tide window (`tide_cache` + `place_tide_rules`); weather (heavy rain → deprioritize waterfalls/beaches flagged risky); festivals (`events_calendar`) adjust crowd.
6. Insert meals (eateries matching diet near route) and stay per night.
7. Generate per-stop reason codes (e.g. `low_crowd`, `sunset`, `open_now`, `tide_safe`) → LLM or template turns codes into short text ("Ganpatipule at 4pm: low crowd + sunset").
8. Return plan + budget.

### 10.3 Budget estimator
stay (stay price) + food (avg meal cost × meals) + fuel (distance × fuel price ÷ mileage; user-editable vehicle/mileage) + entry fees + activities. Per person = total ÷ people.

### 10.4 Group
- Share token; guests vote without login; creator account required.
- AI merges votes (P8) → plan + trade-off text.

### 10.5 Export
- Share link (read-only by token).
- PDF `[DEFAULT: client-side generation]`.
- Google Maps: one URL per day, max 10 stops each.

### 10.6 Pattern analysis (P9)
- Stop-order suggestions (reuse 2-opt).
- Dwell time from opt-in anonymous GPS → update typical visit durations.
- Trending / underrated routes from saved & completed trips.
- Custom routes published after team review.

### 10.7 Ready-made itineraries
~5 rows `is_ready_made = true` (e.g. Ratnagiri in 2 days, Temples of Konkan, Hidden beaches, Forts trail, Family weekend) — content from team.

---

## 11. AI SERVICE "CRABBY" (P8) `[LOCKED]`

### 11.1 Router
| Task | Primary | Fallback |
|---|---|---|
| Intent parsing, moderation, quick replies | Groq Llama 8B | Groq 70B → Gemini Flash-Lite |
| Plan explanations, Q&A (EN/HI/MR) | Gemini Flash / Flash-Lite | Groq 70B |
| Review summaries (nightly batch) | Groq or Gemini | other |
| Recommendations / similar places | embeddings + rules (no LLM) | — |
| Pattern analysis / trending | analytics (no LLM) | — |
| Stay price-compare suggestions | light LLM | — |
| Content helper (internal drafts + translations) | Gemini | Groq 70B |
- On HTTP 429 → next provider. No paid fallback (Gemini has no billing fallback on free tier).
- Do NOT use OpenRouter.
- Model IDs come from env vars; check provider docs for current model names before coding.

### 11.2 Flow
`user msg → emergency keyword check (client, bypass) → auth + daily cap → moderation → intent parse (8B) → tool calls on our DB/planner → explanation model → response + optional action preview`

### 11.3 Tools exposed to the LLM (only these)
- `search_places(filters)`, `get_place(id)`, `search_stays(filters)`, `search_eateries(filters)`, `get_dish(id)`
- `build_plan(inputs)` → P7 planner; `edit_plan(trip_id, ops)`
- `nearby(entity_id | coarse_area, types)` — uses our DB only
- `get_conditions(entity_id)` — weather/tide/monsoon/alerts from our caches
- `propose_action(type, payload)` — creates `ai_actions` row with status `proposed`; UI shows Apply/Discard
- `merge_group_votes(trip_id)`
- No tool returns Ola data. No tool returns phone numbers or location history.

### 11.4 Behaviour rules (system prompt content)
- Answer only from tool results. If not found: say "don't know" + suggest verified nearby alternatives. Never use general knowledge for facts.
- Every plan stop gets a short reason.
- Memory = `user_preferences` only; no chat history stored server-side `[LOCKED]`.
- Languages: EN, HI, MR — reply in user's selected language.
- Never jokes on safety topics.

### 11.5 Limits
- Login required. `ai_usage` cap ~20 messages/user/day. Reset at local midnight (Asia/Kolkata) `[DEFAULT]`.
- Disclose AI processing in privacy policy.

### 11.6 Emergency
Keywords (accident, snake bite, lost child, etc. — full list in EN/HI/MR `[OPEN]` team to finalize) detected client-side before any network call → emergency card. Server also checks and returns `{emergency:true}` without LLM call as a second guard.

### 11.7 Pending
Sarvam AI Startup Program (Suhani) — if approved: Marathi chat + Marathi/Hindi TTS for audio guides. Build provider interface so Sarvam can be added without refactor.

---

## 12. ENVIRONMENT VARIABLES (`.env.example`)

```
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server only

# AI (services/api only)
GROQ_API_KEY=
GEMINI_API_KEY=
AI_MODEL_INTENT=
AI_MODEL_EXPLAIN=
AI_MODEL_FALLBACK_1=
AI_MODEL_FALLBACK_2=
AI_DAILY_MSG_CAP=20

# Ola (services/ola-proxy only — never in services/api)
OLA_API_KEY=

# Context
OPENWEATHER_API_KEY=
TIDESATLAS_API_KEY=
TIDECHECK_API_KEY=
TIDE_PROVIDER=tidesatlas

# Prices
AGODA_PARTNER_ID=
AGODA_API_KEY=
AGODA_ENABLED=false
AFFILIATE_INRDEALS_ID=
AFFILIATE_CUELINKS_ID=

# Push
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# Tiles
PMTILES_BASE_URL=
```

---

## 13. PRICE COMPARISON (P4) `[LOCKED]`

- Live prices: Agoda Partners API (self-serve, ~5% commission). Adapter behind `AGODA_ENABLED`.
- Other OTAs: affiliate deep links via INRDeals/Cuelinks — store in `stay_offers`, no live price unless provided by network.
- Homestays not on OTAs: owner price range + call/WhatsApp.
- Later (not MVP): Booking.com Demand API, MMT API.
- Never scrape. Never take payments.
- Pending: affiliate account owner (PAN/bank) — adapters ship with empty IDs until set.

---

## 14. API SURFACE SUMMARY (build per phase)

| Method + path | Phase | Auth |
|---|---|---|
| `GET /api/places`, `/api/places/:slug` | P4 | anon |
| `GET /api/stays`, `/api/stays/:slug`, `/api/stays/:slug/offers` | P4 | anon |
| `GET /api/eateries`, `/api/eateries/:slug`, `/api/dishes`, `/api/dishes/:slug` | P4 | anon |
| `POST /api/admin/places` (+ stays, eateries), `POST /api/admin/photos` | P4 | verifier |
| `POST /api/admin/drafts/:id/approve` | P4 | reviewer |
| `POST /api/owner/claim`, `PATCH /api/owner/listing/:id` | P4 | owner |
| `GET /api/map/pins?bbox&filters`, `GET /api/map/utilities?bbox&types` | P3 | anon |
| `GET /api/map/alerts`, `GET /api/map/heatmap`, `GET /api/tides/:station?date` | P3/P9 | anon |
| `GET /ola/autocomplete`, `GET /ola/directions` | P3 | user, rate-limited |
| `POST /api/verdicts`, `POST /api/subscores`, `POST /api/reviews` | P5 | user |
| `GET /q/:code`, `POST /q/:code/{scan,visit,report}` | P6 | anon / user for visit |
| `POST /api/trips/plan`, `PATCH /api/trips/:id`, `GET /api/trips/share/:token` | P7 | user / anon for share |
| `POST /api/trips/:token/vote` | P7 | anon guest |
| `GET /api/trips/:id/gmaps`, `GET /api/itineraries` | P7 | user / anon |
| `POST /api/ai/chat`, `POST /api/ai/actions/:id/{apply,discard}` | P8 | user |
| `GET /api/recommend/similar/:place`, `/less-crowded/:place` | P8 | anon |
| `POST /api/dwell` | P9 | consented anon id |
| `POST /api/push/subscribe` | P9 | user |
| `GET /api/packs` | P9 | anon |

All inputs validated with a schema library (zod `[DEFAULT]`). All write endpoints rate-limited.

---

## 15. TESTS (minimum)
- RLS matrix (§4) — P1
- Matrix pipeline: pair count, corrected ≥ raw for flagged segments — P3
- AI firewall static check — P3 onward (CI)
- Verdict aggregation + "New" threshold + verified-only dimensions — P5
- QR distance check server-side (199 m pass, 250 m fail) — P6
- Planner: no stop outside hours; no tide-unsafe stop; Google Maps link ≤10 stops — P7
- AI: daily cap, 429 fallback, no PII in payload, unknown-answer path — P8
- Consent: no dwell rows without consent — P9
