# Crabwalk — Data requirements (pre-launch)

Every piece of data the app reads before real content goes live, and how to collect it. MVP region: Ratnagiri district, 9 talukas (Mandangad, Dapoli, Khed, Chiplun, Guhagar, Sangameshwar, Ratnagiri, Lanja, Rajapur).

**Sources audited (2026-11-03):** `supabase/migrations/*` (24 files), `apps/web/src/lib/db.types.ts`, `lib/server/{listings,admin,review,qr,planner/*}.ts`, every `routes/**/+page.server.ts` / `+server.ts`, detail pages (`place`, `stays`, `food`, `taste-konkan`, `itineraries`), `lib/vocab.ts`, `lib/emergency.ts`, `pipelines/*` (incl. `content-import/schema.ts` + `template.csv`), `supabase/seed/seed.sql`, `CRABWALK_BACKEND.md` §3, §10.7, `CRABWALK_PLAN.md`, `docs/DECISIONS.md`, `docs/reports/01-*.md`, local DB counts.

**Not found anywhere in the repo or user folders:** `Crabwalk Plan.md`, `Crabwalk Design.md`, `Template - Places.md`, `Template - Stays.md`, `Template - Food.md`. The only content template that exists is `pipelines/content-import/template.csv` (places only). See [Open questions](#7-open-questions) Q1.

**Legend**
- Req: `Y` = DB or import rejects the row without it · `Y*` = UI breaks or is empty without it (not enforced) · `C` = conditional (rule in the cell) · `–` = optional.
- Source class: **AI-OK**, **AI-DRAFT**, **FIELD-ONLY** and **SYSTEM**, as defined in the brief.
- Examples show the **format only**. They are not verified facts.
- `→ none` in "used by" = stored but no screen reads it.

---

## 1. Audit — mismatches between UI, schema and templates

| # | Area | Finding | Evidence | Impact |
|---|---|---|---|---|
| M1 | Templates | The named template docs don't exist. The only template is a 28-column **CSV** for **places**. The brief asks for YAML. | `pipelines/content-import/template.csv`, `run.ts` | No import path for anything except places (see M2). |
| M2 | Import coverage | No bulk import exists for stays, eateries, dishes, dish links, seasons, events, tide rules, hospitals' phones, itineraries, QR codes or audio. They are entered one by one: field form (`/admin/field`), reviewer (`/admin/review`), events (`/admin/events`), QR (`/admin/qr`), planner promote (`/plan/[id]`). | write-path grep over `routes`, `lib`, `pipelines` | Bulk AI output for those entities can't be loaded today. |
| M3 | **Tide link** | `places.tide_station_id` has **no write path** (field form, importer, pipelines, migrations). Tide widget, map tide layer, planner tide check and the QR tide line all key on it. | `lib/server/admin.ts` placeInput, `content-import/run.ts`, `pipelines/tide-stations` (writes `tide_stations` only) | Tide features never appear for real places. |
| M4 | Tide rules | `place_tide_rules` has no write path. The planner reads `max_safe_height_m`; **`rule_text` is read by nothing**. Spec marks the rule `[OPEN]` ("from verifiers"). | `planner/data.ts:212`, `api/map/tides` | Tide safety depends on rows nobody can enter. |
| M5 | Seasons | `place_seasonal` has no write path, but the home "Today on the coast" strip and the season badges read it. | `listings.ts seasonStrip`, `TodayStrip.svelte` | The season strip stays empty. |
| M6 | Hours shape | `place_hours` / `eatery_hours` allow **one open–close interval per weekday**. Temples and eateries often close mid-day. The importer also takes one `opens`/`closes` pair for all days, plus `closed_days`. | `listings.sql` place_hours; `schema.ts hoursOf` | Split hours can't be stored, so the "open now" check is wrong for those listings. |
| M7 | Names (HI) | The importer and field form write `name_en` + `name_mr` only. Hindi names and all HI/MR long text come only from reviewer edits in `/admin/review` (`content_drafts`). | `schema.ts COLUMNS`, `admin.ts names()`, `review.ts FIELDS` | HI pages fall back to EN names. |
| M8 | Long text | The importer sends EN long text to `content_drafts` for review. It can't take HI/MR text. | `run.ts`, `DRAFT_FIELDS` | AI translations must go in through the reviewer UI. |
| M9 | Per-fact sources | The brief wants `source_url` per fact. The schema stores `places.source_urls text[]` (1–10, per **place**) and nothing for stays, eateries, dishes or events. | `20261102110000_place_provenance.sql` | Per-fact provenance is lost on import (Q4). |
| M10 | `status: ai_draft` | No such status exists. `content_status` = `draft`/`in_review`/`published`. The importer sets `in_review` + `verification_method = 'desk'`. | `extensions_enums.sql`, `run.ts` | The YAML `status` must map to these (Q5). |
| M11 | Hidden gem | Spec: `is_hidden_gem` is set by a verifier only. The desk importer accepts it from CSV. | BACKEND §3.3; `schema.ts` | AI rows could mark gems (Q8). |
| M12 | Coordinates | Brief: GPS is FIELD-ONLY. Report 1 §1.4: the team collects **with no site visits**. The importer requires lat/lng. | `docs/reports/01-*.md:18` | The source of desk coordinates is undecided (Q6). |
| M13 | Photos | BACKEND §3.3: photos are verifier/owner-shot only `[LOCKED]`. T-7/T-51 later allowed CC BY / CC BY-SA photos with credit, licence and source URL. | `photo_credits.sql` | Resolved by T-7. Licensed Commons photos are allowed; stock photos are not. |
| M14 | Eatery `vibe_tags` | In the schema and spec. No vocabulary, no form field, no UI reader. | `listings.sql`; `admin.ts eateryInput` | Excluded from collection (Q9). |
| M15 | Eatery `service_style` | Collected by the field form; no UI reads it. | `food/[slug]/+page.server.ts` | P2. |
| M16 | `crowd_typical.season` | Column exists; never written or read. | grep | Excluded. |
| M17 | Eatery `menu` | UI reads `menu.items[]`. Only the owner portal writes it; the field form doesn't. | `owner.ts`; `food/[slug]` | Needs an admin path for desk data (M2). |
| M18 | Itinerary titles | `trips.title` is one string, with no HI/MR. Stop `reason_en/hi/mr` are generated by the planner. Ready-made trips are made by planning a trip in the app and promoting it. | `itineraries.ts`, `plan/[id]/+page.server.ts:127` | Ready-made titles show in one language on HI/MR pages. |
| M19 | Stay price source | `price_source` ∈ `owner`/`agoda`/`affiliate`. A price an AI finds on an OTA page fits none of them. | `extensions_enums.sql` | Q10. |
| M20 | Hospitals | OSM gives 151 `hospital` rows, but only **1 has a phone**. The EmergencyCard shows the nearest hospital with a call button. Per taluka: Mandangad 2, Guhagar 3, Lanja 3, Rajapur 3. | local DB `utility_pois` | Emergency "call hospital" is missing almost everywhere. |
| M21 | OSM utility quality | 79 `railway_station` rows (OSM includes halts and platforms), 11 ATMs (10 unnamed), 8 police. | local DB | Utility data is thin and needs verification. |
| M22 | Seed vs local DB | The dev seed is 5 places, 3 stays, 3 eateries and 3 dishes. The local DB holds 240/164/52 rows, mostly e2e test data. There is **no real content anywhere**. | `seed.sql`, DB counts | Every row in this spec is new collection. |
| M23 | Hosted DB | The hosted Supabase project no longer resolves (DECISIONS "Found issues"). | DECISIONS | No import target until it is restored or recreated (Q2). |

---

## 2. Entity specs

Priority: **P0** = launch blocker (a core screen is empty or broken, or a safety gap) · **P1** = launch-quality feature is empty · **P2** = post-launch or nice to have.

Spec-given targets: places **100–200** (exact number `[OPEN]`, DECISIONS "Pending"), ready-made itineraries **~5** (BACKEND §10.7), **one photo per place** (Report 1). Every other target below is a **proposal**, to be approved under Q3.

Coastal talukas: Mandangad, Dapoli, Guhagar, Ratnagiri, Rajapur. Inland: Khed, Chiplun, Sangameshwar, Lanja.

### 2.1 Places — P0

**Purpose:** Discover (`/`), category lists, place detail (`/place/[slug]`), map pins and search, planner, Crabby tools, QR page (`/q/[code]`), "similar" and "less crowded" recommendations, sitemap.

| field | type / format | req | example | used by | source class |
|---|---|---|---|---|---|
| slug | `^[a-z0-9]+(-[a-z0-9]+)*$`, ≤ 60, unique | Y | `ratnadurg-fort` | URLs, sitemap | SYSTEM (from name_en) |
| name_en | text 2–120 | Y | `Ratnadurg Fort` | cards, detail, map, search, QR, Crabby | AI-OK |
| name_mr | text ≤ 120, Devanagari | Y* | `रत्नदुर्ग किल्ला` | detail secondary name, MR UI | AI-DRAFT |
| name_hi | text ≤ 120 | – | `रत्नदुर्ग किला` | HI UI (falls back to EN) | AI-DRAFT (M7) |
| category | enum: beach, fort, temple, waterfall, viewpoint, backwater, cave, museum, village, market, orchard | Y | `fort` | cards, filter, map icon, planner visit time | AI-OK |
| taluka | one of the 9 `talukas.name_en` | Y | `Ratnagiri` | detail, verifier scope, planner | AI-OK (checked against boundary) |
| lat, lng | WGS84 decimal, ≥ 5 dp, inside the taluka boundary | Y | `16.99950, 73.27470` | map, nearby, travel matrix, QR 200 m radius, nearest weather/tide | FIELD-ONLY (Q6) |
| entry_fee_text | text ≤ 1000 | – | `₹__ adults, ₹__ children` | detail | AI-OK |
| entry_fee_inr | int 0–100000 (adult) | – | `0` | planner budget | AI-OK |
| visit_minutes | int 10–600 | – | `120` | planner (default: `category_visit_minutes`) | AI-DRAFT |
| opens / closes | `HH:MM`, both or neither | – | `06:00` / `20:00` | detail hours, open-now, planner | AI-OK (M6) |
| closed_days | list of mon…sun | – | `[tue]` | same | AI-OK |
| best_time_text | text ≤ 1000 | – | `Oct–Feb, before 10:00` | detail | AI-DRAFT |
| how_to_reach_text | text ≤ 1000 | – | | detail | AI-DRAFT |
| nearest_station_text | text ≤ 1000 | – | `Ratnagiri (__ km)` | detail | AI-OK |
| nearest_bus_stop_text | text ≤ 1000 | – | | detail | AI-OK |
| monsoon_status | enum: open, risky, closed (default open) | Y | `risky` | card badge, detail, planner, QR, Crabby | AI-DRAFT |
| monsoon_reason | text ≤ 1000 | C: when status ≠ open | `Slippery rocks Jun–Sep` | card, detail | AI-DRAFT |
| is_tide_dependent | bool | Y | `false` | badge, planner, map tide layer | AI-DRAFT |
| tide_station (link) | nearest `tide_stations` row | C: tide-dependent | (computed) | tide widget, planner, QR | SYSTEM (M3: no write path) |
| is_hidden_gem | bool | Y | `false` | badge, filter, planner | FIELD-ONLY (M11) |
| food_delivery | `{swiggy, zomato, eatsure, magicpin: bool}` | – | `{zomato: true}` | detail "Food delivery here" | FIELD-ONLY (app checked at the spot) |
| source_urls | 1–10 `https://` URLs | Y (desk) | | review, provenance | AI-OK |
| verification_method | `desk` / `field` | Y | `desk` | detail ("Visited" only when field) | SYSTEM |
| status, last_verified_at, next_recheck_at, created_at | | | | cards ("Last verified"), re-check queue | SYSTEM |
| dwell_minutes | int 5–600 | – | | planner | SYSTEM (consented dwell events) |
| **Translations** (`place_translations`, per en/hi/mr) | | | | | |
| short_story | text ≤ 5000; paragraphs separated by a blank line (paragraph 1 = lead) | Y* | | detail story, QR page, embeddings, Crabby | AI-DRAFT |
| history | text ≤ 5000 | – | | detail | AI-OK (reviewed as text) |
| significance | text ≤ 5000 | – | | detail | AI-DRAFT |
| dos / donts | text ≤ 5000 | – | | detail, QR | AI-DRAFT |
| safety_text | text ≤ 5000 | – | | detail, QR | AI-DRAFT |
| **Child rows** | | | | | |
| place_hours | 7 rows: weekday 0–6 (0 = Sun), opens, closes, hours_unknown | – | | detail, planner | AI-OK |
| crowd_typical | 7 rows: weekday, level ∈ empty/calm/busy | – | `{6: busy}` | detail "crowd today", less-crowded, planner | FIELD-ONLY |
| verifier_notes | free text, internal | – | | AI drafting input | FIELD-ONLY |

**Targets (places)** — total min **100** / ideal **200** (spec range).

| Taluka | Mandangad | Dapoli | Khed | Chiplun | Guhagar | Sangameshwar | Ratnagiri | Lanja | Rajapur | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| Min viable | 8 | 16 | 9 | 10 | 12 | 9 | 18 | 7 | 11 | **100** |
| Ideal | 16 | 32 | 18 | 20 | 24 | 18 | 36 | 14 | 22 | **200** |

Proposed coverage rule: in every taluka, at least one place in each category that exists there. Every place needs `short_story` EN; MR/HI after review.

### 2.2 Place photos — P1 (cards fall back to a no-photo state)

**Purpose:** hero on cards and detail, gallery, QR page thumbnail, dish chips. Table `photos` (shared by place, stay, eatery and dish).

| field | type / format | req | example | used by | source class |
|---|---|---|---|---|---|
| file | WebP ≤ 3 MB (bucket rule), path `<type>/<id>/<file>` | Y | | all cards, hero | FIELD-ONLY, or AI-DRAFT for a licensed photo |
| is_hero | bool, one per listing | Y* | `true` | cards | FIELD-ONLY |
| credit | text 1–200 | C: licensed | `Jane Doe` | caption under image | AI-DRAFT |
| licence | CC BY / CC BY-SA 2.0, 2.5, 3.0 or 4.0 | C: licensed | `CC BY-SA 4.0` | caption | AI-DRAFT (licence must be checked by a human) |
| source_url | `https://`, ≤ 500 | C: licensed | Commons file page | caption link | AI-OK |
| width, height, lqip, uploaded_by | | | | layout, blur placeholder | SYSTEM |

Credit fields: all three empty (our own photo) or all three filled. Never stock photos, never unlicensed web images.

**Targets:** min 1 hero per place (100) / ideal 3 per place (600).

### 2.3 Seasonal highlights (`place_seasonal`) — P1

**Purpose:** "Today on the coast" season strip on Discover, season badges.

| field | type / format | req | example | used by | source class |
|---|---|---|---|---|---|
| place (slug) | existing place | Y | `velas-beach` | strip | AI-OK |
| season | enum: turtle_nesting, mango, firefly, waterfall | Y | `turtle_nesting` | strip label | AI-DRAFT |
| from_month / to_month | int 1–12 (wrap allowed, e.g. 11 → 3) | Y | `2` / `4` | "active this month" | AI-DRAFT |

**Targets:** min 3 places per season (**12** rows) / ideal every place where a season applies (est. 40–60). Region-wide, not per taluka. Write path missing (M5).

### 2.4 Tide stations, tide links and tide rules — P1

**Purpose:** tide widget on place detail, map tide layer, planner tide-safety check, QR page tide line, Crabby.

| field | type / format | req | example | used by | source class |
|---|---|---|---|---|---|
| tide_stations.name / location / provider_station_id | from TideCheck "nearest station" per anchor | Y | | all tide features | SYSTEM (`pipelines/tide-stations`, 6 anchors in `region.json`) |
| place → station link | nearest station to a tide-dependent place | C | | same | SYSTEM (M3) |
| place_tide_rules.max_safe_height_m | numeric(4,2), metres | C: tide-dependent | `1.20` | planner | FIELD-ONLY (spec `[OPEN]`) |
| place_tide_rules.rule_text | text | – | `Cross to the islet only at low tide` | → none (M4) | FIELD-ONLY |

**Targets:** stations: about 6 (pipeline). Links and rules: one per tide-dependent place. The count of tide-dependent places is unknown until places are collected.

### 2.5 Stays — P0

**Purpose:** `/stays` list and filters, stay detail, map pins, "Near me now" on QR pages, planner (overnight stops, `price_min`), Crabby `shortlist_stays`.

| field | type / format | req | example | used by | source class |
|---|---|---|---|---|---|
| slug | as for places | Y | `sea-breeze-homestay-ganpatipule` | URL | SYSTEM |
| name_en / name_mr / name_hi | text 2–120 | Y / Y* / – | | list, detail | AI-OK / AI-DRAFT / AI-DRAFT |
| description (en/hi/mr) | text | Y* | | detail | AI-DRAFT |
| taluka | one of 9 | Y | | filter, scope | AI-OK |
| lat, lng | as for places | Y | | map, nearby, planner | FIELD-ONLY (Q6) |
| vibe_tags | subset of: traditional_konkani_home, family, luxury, business, backpacker, couple_friendly, pet_friendly, beachfront, orchard_stay | – | `[family, beachfront]` | list chips, filter | AI-DRAFT |
| service_style | homely / professional | – | `homely` | list, filter, detail | AI-DRAFT |
| amenities | `{ac, hot_water, wifi, parking, power_backup: bool}` | – | `{wifi: true, ac: false}` | list filter, detail | FIELD-ONLY |
| network_strength | `{Jio, Airtel, Vi, BSNL: none/weak/good}` | – | `{Jio: good, BSNL: weak}` | detail bars | FIELD-ONLY |
| food_at_stay | `{veg, non_veg, malvani, jain, homemade_included: bool}` | – | `{malvani: true}` | detail | AI-DRAFT |
| price_min / price_max | int ₹ per night, max ≥ min | Y* | `1500` / `2500` | list, filter, planner budget, price tip | AI-DRAFT (Q10) |
| price_source | owner / agoda / affiliate | C: price set | `owner` | list ("price from …") | SYSTEM (Q10) |
| phone / whatsapp | `^\+?[\d\s-]{6,20}$` | – | `+91 9xxxxxxxxx` | detail call/WhatsApp | AI-DRAFT (Q11) |
| is_verified | bool | – | | badge | FIELD-ONLY |
| owner_id, claimed_at | | | | "claim this listing" | SYSTEM |
| status, last_verified_at | | | | | SYSTEM |
| **stay_offers** (P2: Agoda is post-launch, Report 1) | provider, deep_link (https), affiliate_network ∈ agoda_partners/inrdeals/cuelinks, live_price, fetched_at | – | | price comparison | AI-OK for the listing URL; SYSTEM for price (Q12) |
| photos | see 2.2 | Y* | | cards | FIELD-ONLY (owner/verifier) |

**Targets (stays)** — proposed.

| Taluka | Mandangad | Dapoli | Khed | Chiplun | Guhagar | Sangameshwar | Ratnagiri | Lanja | Rajapur | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| Min viable | 3 | 8 | 4 | 5 | 6 | 4 | 8 | 3 | 4 | **45** |
| Ideal | 6 | 16 | 8 | 10 | 12 | 8 | 16 | 6 | 8 | **90** |

Mix rule (proposed): each taluka has at least one `homely` and, where one exists, one `professional`.

### 2.6 Dishes — P1 (collect **before** eateries)

**Purpose:** Taste Konkan (`/taste-konkan`, `/taste-konkan/[dish]`), eatery dish chips, eatery list "signature dish".

| field | type / format | req | example | used by | source class |
|---|---|---|---|---|---|
| slug | `^[a-z][a-z0-9_-]{1,40}$` (admin form) | Y | `solkadhi` | URL, links | SYSTEM |
| name (en/hi/mr) | text | Y (EN) | `Solkadhi` / `सोलकढी` | all dish surfaces | AI-OK (EN), AI-DRAFT (HI/MR) |
| what_it_is (en/hi/mr) | one-line text | Y* | | list card, detail | AI-OK |
| story (en/hi/mr) | text | – | | detail | AI-DRAFT |
| photo | see 2.2 | Y* | | list, chips | FIELD-ONLY or licensed |

Spec seed list (BACKEND §3.5): solkadhi, kombdi_vade, bangda_fry, surmai_thali, modak, ghavane, aamras, kokum_sherbet.

**Targets:** min **8** (spec list) / ideal **25**. Region-wide.

### 2.7 Eateries — P0

**Purpose:** `/food` list and filters, eatery detail, dish → "where to eat it", map pins, QR "Near me now", planner meal stops.

| field | type / format | req | example | used by | source class |
|---|---|---|---|---|---|
| slug | as for places | Y | | URL | SYSTEM |
| name_en / name_mr / name_hi | text 2–120 | Y / Y* / – | | list, detail | AI-OK / AI-DRAFT / AI-DRAFT |
| description (en/hi/mr) | text | Y* | | detail | AI-DRAFT |
| taluka | one of 9 | Y | | filter | AI-OK |
| lat, lng | as for places | Y | | map, nearby, planner | FIELD-ONLY (Q6) |
| authenticity | home_style / local_legend / tourist_oriented | Y* | `local_legend` | list chip, filter | AI-DRAFT |
| price_for_two | int ₹ | Y* | `600` | list, filter, planner food budget | AI-OK |
| diet_flags | `{veg, non_veg, jain: bool}` | Y* | `{veg: true, non_veg: true}` | list, filter, planner diet | AI-OK |
| food_apps | `{swiggy, zomato, eatsure, magicpin: {available: bool, link: https}}` | – | `{zomato: {available: true, link: "https://…"}}` | detail order buttons (https links only) | AI-OK |
| menu | `{items: [string]}` | – | `{items: ["Surmai thali", "Solkadhi"]}` | detail menu | AI-DRAFT (M17) |
| hours | 7 rows, as `place_hours` | – | | detail, open-now, planner | AI-OK (M6) |
| dishes (links) | ≤ 10 × `{dish_slug, is_signature, is_best_for}` | Y* | `{solkadhi, signature: true}` | detail chips, list signature, dish page ranking | AI-DRAFT |
| phone / whatsapp | as for stays | – | | detail | AI-DRAFT (Q11) |
| service_style | homely / professional | – | | → none (M15) | AI-DRAFT |
| is_verified, owner_id, status, last_verified_at | | | | badge, claim | FIELD-ONLY / SYSTEM |
| photos | see 2.2 | Y* | | cards | FIELD-ONLY |

Hygiene is a user sub-score (`sub_scores.dimension = hygiene`), so it is SYSTEM and not collected.

**Targets (eateries)** — proposed.

| Taluka | Mandangad | Dapoli | Khed | Chiplun | Guhagar | Sangameshwar | Ratnagiri | Lanja | Rajapur | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| Min viable | 4 | 8 | 5 | 8 | 6 | 5 | 10 | 3 | 5 | **54** |
| Ideal | 8 | 16 | 10 | 16 | 12 | 10 | 20 | 6 | 10 | **108** |

Coverage rule (proposed): each of the 8 spec dishes is linked to at least 2 eateries.

### 2.8 Utilities (fuel, ATM, hospital, pharmacy, police, toilet, EV charger, mechanic, bus stand, railway station, ferry jetty) — P0 for hospitals, P1 for the rest

**Purpose:** map utility layer, place detail "nearby", QR "Near me now" (fuel, ATM, toilet, hospital), EmergencyCard (nearest hospital + call), offline taluka packs.

| field | type / format | req | example | used by | source class |
|---|---|---|---|---|---|
| type | enum (11 above) | Y | `hospital` | map, nearby, emergency | SYSTEM (OSM pipeline) |
| location | point | Y | | distance sort | SYSTEM (OSM) / FIELD-ONLY (verifier rows) |
| name | text | Y* | `District Civil Hospital` | map, emergency | SYSTEM (OSM); fill gaps AI-OK |
| phone | text | Y* for hospital and police | | EmergencyCard call button | AI-OK (official listings) + call to verify |
| osm_id, source (`osm`/`verifier`), taluka_id | | | | dedupe | SYSTEM |

Current OSM coverage: hospital 151 (1 with phone), railway_station 79, fuel 30, bus_stand 29, ferry_jetty 21, ATM 11, police 8, toilet 8, mechanic 7, pharmacy 3, EV charger 1.

**Targets (emergency data, P0):** min: per taluka, the 2 nearest-to-HQ hospitals with 24 h emergency, verified phone and correct pin (**18**), plus 1 police station per taluka (**9**). Ideal: every OSM hospital checked (real hospital vs clinic, phone), plus police and pharmacy per taluka.

### 2.9 Emergency keywords — P0

**Purpose:** EmergencyCard trigger (checked before any AI call). File `apps/web/src/lib/emergency.ts`, which is code, not a DB table.

| field | type | req | used by | source class |
|---|---|---|---|---|
| EN / HI / MR keyword lists | string arrays | Y | Crabby emergency guard | AI-DRAFT (a Claude draft exists; the team must review: DECISIONS P8-3) |

### 2.10 Ready-made itineraries — P1

**Purpose:** Discover "Ready-made trips", `/itineraries`, `/itineraries/[slug]`, Crabby.

| field | type / format | req | example | used by | source class |
|---|---|---|---|---|---|
| title | text (single language, M18) | Y | `Ratnagiri in 2 days` | cards, detail | AI-DRAFT |
| slug | `^[a-z0-9-]+$` | Y | `ratnagiri-2-days` | URL | SYSTEM |
| days | int 1–30 | Y | `2` | detail | AI-DRAFT |
| pace | relaxed / balanced / packed | Y | `balanced` | detail | AI-DRAFT |
| stops | ordered list per day of place, stay or eatery (`kind` place/stay/meal) | Y | | day list, map | AI-DRAFT (only published listings) |
| arrive_at, depart_at, travel_from_prev_s, reason_* | | | | timeline | SYSTEM (planner) |
| trip_budget | stay, food, fuel, entry, activities, people | | | BudgetCard | SYSTEM (planner, from prices and config) |

Created by planning the trip in the app and promoting it (`/plan/[id]`), not by import (DECISIONS P7-15). Spec examples: Ratnagiri in 2 days, Temples of Konkan, Hidden beaches, Forts trail, Family weekend.

**Targets:** min **5** (spec) / ideal 10 (proposed). Region-wide; proposed rule: together they cover at least 6 of the 9 talukas.

### 2.11 Festival and event calendar (`events_calendar`) — P1

**Purpose:** "Today on the coast" strip (events this month), planner crowd adjustment (`impact.crowd = busy`).

| field | type / format | req | example | used by | source class |
|---|---|---|---|---|---|
| name_en / name_hi / name_mr | text | Y / – / – | `Ganeshotsav` | strip | AI-OK / AI-DRAFT |
| type | festival / jatra / season | Y | `jatra` | strip | AI-OK |
| from_date / to_date | ISO date, to ≥ from | Y | `2027-09-04` | strip, planner | AI-OK (lunar dates change every year) |
| taluka | one of 9, or null = district-wide | – | `Guhagar` | planner scope | AI-OK |
| impact.crowd | busy / calm | – | `busy` | planner | AI-DRAFT |
| impact.closures | text ≤ 300 | – | `Road to temple closed to cars` | → admin only | AI-DRAFT |

**Targets:** min: about 10 district-wide festivals plus 1 major jatra per taluka (**~19**) / ideal 3–5 jatras per taluka (**~45**). Dates for at least the next 12 months; refresh yearly.

### 2.12 Monsoon and road alerts (`alerts`) — P2 for launch content

**Purpose:** map alert layer, planner (`planner_alerted_places`), Crabby. Rows expire: road_condition and ghat after 24 h, landslide and closure after 48 h (`alert_type_ttl`).

| field | type / format | req | used by | source class |
|---|---|---|---|---|
| type | road_condition / ghat / landslide / closure | Y | map | FIELD-ONLY or team news |
| geometry, severity (caution/danger), reason_en/hi/mr | | Y | map | FIELD-ONLY |
| source | verifier / user_report / team_news | Y | | SYSTEM |
| reported_at, expires_at, confirmed_at | | Y | | SYSTEM |

**Not collected in advance.** Rows are live and time-limited, and pre-filled alerts would break the "no fake live data" rule. Static monsoon risk belongs in `places.monsoon_status` / `monsoon_reason` (2.1). Target at launch: **0**.

### 2.13 QR plaques (`qr_codes`, `sponsors`) — P2

**Purpose:** `/q/[code]` scan page (name, photo, story, do's/don'ts, safety, audio, tide, "Near me now", report form), GPS-verified visits.

| field | type / format | req | example | used by | source class |
|---|---|---|---|---|---|
| code | `^[A-Z]{2,5}-[0-9]{3,}$` (region prefix) | Y | `RTN-001` | URL | SYSTEM (`create_qr_code`) |
| entity | place / stay / eatery / station / bus_stand (utility) | Y | | page content | SYSTEM |
| permission_body | text: ASI, state archaeology, temple trust, gram panchayat | Y* | `Gram Panchayat Ganpatipule` | admin | AI-DRAFT (which authority) |
| permission_status | pending / granted | Y | | admin | FIELD-ONLY |
| installed_at | timestamp | – | | admin | FIELD-ONLY |
| sponsor | name + nearby stay/eatery | – | | page footer (display only) | FIELD-ONLY (business deal) |

**Targets:** min **20** plaques at the top places (proposed) / ideal **50**. Each needs a published place with EN/MR story, do's/don'ts and safety text.

### 2.14 Audio guide scripts (`audio_guides`) — P2 (Report 1: audio is post-launch)

**Purpose:** AudioGuidePlayer on place detail and QR page; the transcript is shown with the player.

| field | type / format | req | example | used by | source class |
|---|---|---|---|---|---|
| place, lang | one per place per language | Y | | player | SYSTEM |
| transcript | text; length to fit 60–300 s of speech | Y* | | transcript panel | AI-DRAFT (from the approved story) |
| audio file | mp3/m4a/ogg/webm ≤ 10 MB | Y | | player | FIELD-ONLY (recorded) or SYSTEM (TTS) |
| duration_s | int 60–300 | Y | `180` | player | SYSTEM |
| source | tts / recorded | Y | | | SYSTEM |

**Targets:** launch **0** / ideal the 20 QR places × 3 languages = **60** scripts.

### 2.15 Translations (EN / HI / MR) — P0 for UI strings and taluka names, P1 for content

| item | volume | used by | source class | status |
|---|---|---|---|---|
| UI strings (`apps/web/messages/{en,hi,mr}.json`) | 813 keys × HI + MR = **1,626** | whole UI | AI-DRAFT | All HI/MR unreviewed (`messages/NEEDS_REVIEW.md`) |
| Taluka names HI/MR | 9 × 2 = **18** | everywhere | AI-DRAFT | Team review pending (P1-16), e.g. Chiplun HI `चिपलून` vs MR `चिपळूण` |
| Place names MR (HI) | 100–200 (× 2) | detail, map | AI-DRAFT | |
| Place long text HI/MR | 6 fields × places × 2 | detail, QR | AI-DRAFT | via `/admin/review` only (M8) |
| Stay, eatery and dish names and descriptions HI/MR | per listing | detail | AI-DRAFT | via `/admin/review` |
| Event names HI/MR | per event | strip | AI-DRAFT | |
| Emergency keywords | see 2.9 | | AI-DRAFT | |

Marathi copy is written natively and team-reviewed (FRONTEND §10).

### 2.16 Other entities found in the code

| entity | purpose | status | class | priority |
|---|---|---|---|---|
| `regions`, `talukas` (+ boundary, pack_url) | region scope, taluka check, offline packs | exist (1 region, 9 talukas); boundaries from pipeline | SYSTEM | P0 (done) |
| `weather_points` | Today strip, planner rain check | 20 seeded (9 HQs, 9 coastal, 2 ghats) | SYSTEM | done |
| `trails` | map trails, GPX download | 131 from OSM; difficulty from `sac_scale` | SYSTEM; difficulty FIELD-ONLY to verify | P2 |
| `category_visit_minutes` | planner visit time fallback | seeded defaults (beach 90 … viewpoint 30) | team review | P1 |
| `app_config.fuel_price_inr`, `default_mileage_kmpl` | planner fuel budget | **null**, so users must type them | AI-OK (current petrol price) + admin | P1 |
| `correction_factors` | travel time ×1.40 ghat, ×1.20 coastal, ×1.25 monsoon | seeded G8 defaults | team review | P1 |
| `matrix_points`, `travel_matrix` | planner, Near me now | `osrm-matrix` pipeline after listings exist | SYSTEM | P0 (run after import) |
| `place_embeddings` | similar places | `embeddings` pipeline after stories are published | SYSTEM | P1 |
| verdicts, sub_scores, reviews, review_summaries, verified_visits, saved_items, trips (user) | ratings, personal data | user-generated | SYSTEM | n/a |

---

## 3. Field audit — what each screen reads

| screen / feature | places | stays | eateries | dishes | other |
|---|---|---|---|---|---|
| Discover `/` | name, category, gem, tide flag, monsoon status/reason, last_verified, location, hero | – | – | – | place_seasonal, events_calendar, weather_cache, tide_cache, ready-made trips |
| Place detail | all 2.1 fields except entry_fee_inr, visit_minutes, source_urls; hours; crowd today; audio; photos; taluka name | nearby (map_pins) | nearby | – | utilities nearby, ratings, similar, less-crowded |
| `/stays` | – | name, vibe_tags, service_style, amenities, price_min/max, price_source, is_verified, last_verified, hero | – | – | – |
| Stay detail | – | name, description, vibes, style, amenities, network, food_at_stay, phone, whatsapp, verified, claimed, last_verified, location, photos | – | – | stay_offers / prices, ratings |
| `/food` | – | – | name, authenticity, price_for_two, diet_flags, signature dish, last_verified, hero | name | – |
| Eatery detail | – | – | name, description, authenticity, price_for_two, diet, menu.items, food_apps (https), hours, phone, whatsapp, verified, claimed, location, photos, dishes | name, photo | ratings |
| Taste Konkan | – | – | name, price_for_two (per dish) | name, what_it_is, story, photo | eatery_dishes.is_best_for, is_signature |
| Planner | category, location, taluka, gem, tide flag + link, monsoon, visit_minutes, dwell_minutes, entry_fee_inr, hours, crowd, tide rule height | location, price_min | location, hours, diet, price | – | matrix, category_visit_minutes, app_config, events impact, weather, verdict_agg, alerts, tide_cache |
| QR page | name, photo, short_story, dos, donts, safety_text, audio, monsoon, tide | 2 nearest | 2 nearest | – | sponsor name, utilities |
| Map | category, location, name, tide link | location, name | location, name | – | utilities, trails, alerts, tides, heatmap |
| EmergencyCard | – | – | – | – | utility_pois hospital name, location, phone |

---

## 4. AI collection pack

### 4.1 Tool fit

| Task | Best tool | Why |
|---|---|---|
| Sourced facts (fees, timings, stations, festival dates, hospital phones, OTA/app URLs, Commons photos and licences) | **Perplexity** | Returns citations; each fact must carry a `source_url` |
| Drafting (stories, do's/don'ts, safety, best time, monsoon reason, descriptions, itinerary titles) | **Claude** or **ChatGPT**, fed with the verified facts from the Perplexity pass | Writing quality; must not add facts not in the input |
| Translation EN → MR / HI | **Claude** or **ChatGPT**, then a native reviewer | Devanagari quality; Marathi needs native review |
| Coordinates | Not an LLM (Q6). Candidates: OSM (`pipelines/data/places.geojson`), Wikidata, a manual map pin, or the field form | LLM coordinates are unreliable |

### 4.2 Batches (about 10 entries per prompt)

| Entity | Batch | Fields | Tool | Input given to the LLM |
|---|---|---|---|---|
| Places | P-A identity | name_en, name_mr, category, taluka, wikidata/osm id, source_urls | Perplexity | taluka + category |
| Places | P-B facts | entry_fee_text, entry_fee_inr, opens, closes, closed_days, nearest_station_text, nearest_bus_stop_text, how_to_reach_text | Perplexity | P-A rows |
| Places | P-C conditions | best_time_text, monsoon_status, monsoon_reason, is_tide_dependent, visit_minutes, seasons[] | Perplexity, then Claude | P-A rows |
| Places | P-D text EN | short_story, history, significance, dos, donts, safety_text | Claude | P-A + P-B + P-C rows with their sources |
| Places | P-E translation | name_hi, and MR/HI for P-D | Claude | approved P-D |
| Photos | PH | Commons file URL, credit, licence, source_url | Perplexity | P-A rows |
| Dishes | D-A | slug, name_en/mr/hi, what_it_is, story | Perplexity, then Claude | dish list |
| Eateries | E-A identity | name_en, name_mr, taluka, authenticity, price_for_two, diet_flags, source_urls | Perplexity | taluka |
| Eateries | E-B ops | opens/closes/closed_days, food_apps links, phone, menu.items, dishes[] (slugs from D-A) | Perplexity | E-A rows + dish slugs |
| Eateries | E-C text | description en/mr/hi | Claude | E-A + E-B |
| Stays | S-A identity | name_en, name_mr, taluka, service_style, vibe_tags, price_min/max, phone, food_at_stay, source_urls | Perplexity | taluka |
| Stays | S-B text | description en/mr/hi | Claude | S-A |
| Events | EV | name_en/hi/mr, type, from_date, to_date, taluka, impact | Perplexity | year + taluka |
| Utilities | U | hospital/police name, phone, 24 h emergency yes/no, source_url | Perplexity | OSM rows per taluka |
| Itineraries | I | title, days, pace, ordered stop slugs per day | Claude | published listing slugs + travel times |
| UI strings | T | key → HI/MR | Claude | `en.json` chunk of 50 keys |

### 4.3 Prompt rules (every batch)

1. Return **YAML only**, one list item per entry, in the exact key order below.
2. Unknown value = `null`. Never estimate, never fill from memory without a source.
3. Every fact key has a matching entry in `_sources` with an `https://` URL. A fact without a URL must be `null`.
4. Use enum values exactly as listed. Never invent new ones.
5. `status: ai_draft` on every entry; the importer maps it (Q5).
6. Draft text uses only facts present in the input YAML.

### 4.4 YAML formats

Keys map 1:1 to DB columns, or to importer columns where one exists. `_sources` is per field (M9).

```yaml
# places — batches P-A…P-E merged into one record
- slug: ratnadurg-fort
  status: ai_draft
  name_en: Ratnadurg Fort
  name_mr: null
  name_hi: null
  category: fort            # beach|fort|temple|waterfall|viewpoint|backwater|cave|museum|village|market|orchard
  taluka: Ratnagiri         # Mandangad|Dapoli|Khed|Chiplun|Guhagar|Sangameshwar|Ratnagiri|Lanja|Rajapur
  lat: null                 # see Q6
  lng: null
  entry_fee_text: null
  entry_fee_inr: null       # int, adult, ₹
  visit_minutes: null       # 10–600
  opens: null               # "HH:MM"
  closes: null
  closed_days: []           # [mon, tue, …]
  best_time: null
  how_to_reach: null
  nearest_station: null
  nearest_bus_stop: null
  monsoon_status: open      # open|risky|closed
  monsoon_reason: null
  is_tide_dependent: false
  is_hidden_gem: false      # FIELD-ONLY; AI must leave false (Q8)
  seasons: []               # [{season: turtle_nesting|mango|firefly|waterfall, from_month: 1-12, to_month: 1-12}]
  text:
    en: {short_story: null, history: null, significance: null, dos: null, donts: null, safety_text: null}
    mr: {short_story: null, history: null, significance: null, dos: null, donts: null, safety_text: null}
    hi: {short_story: null, history: null, significance: null, dos: null, donts: null, safety_text: null}
  photo: {file_url: null, credit: null, licence: null, source_url: null}
  _sources:
    name_en: [https://…]
    entry_fee_text: [https://…]
```

```yaml
# stays
- slug: null
  status: ai_draft
  name_en: null
  name_mr: null
  name_hi: null
  taluka: null
  lat: null
  lng: null
  service_style: null       # homely|professional
  vibe_tags: []             # traditional_konkani_home|family|luxury|business|backpacker|couple_friendly|pet_friendly|beachfront|orchard_stay
  food_at_stay: {veg: null, non_veg: null, malvani: null, jain: null, homemade_included: null}
  price_min: null           # ₹/night int
  price_max: null
  phone: null
  whatsapp: null
  description: {en: null, mr: null, hi: null}
  ota_links: []             # [{provider: booking_com|makemytrip|agoda|…, url: https://…}] — Q12
  _sources: {}
  # FIELD-ONLY, not in AI output: amenities, network_strength, is_verified, photos
```

```yaml
# dishes
- slug: solkadhi            # ^[a-z][a-z0-9_-]{1,40}$
  status: ai_draft
  name: {en: Solkadhi, mr: null, hi: null}
  what_it_is: {en: null, mr: null, hi: null}
  story: {en: null, mr: null, hi: null}
  photo: {file_url: null, credit: null, licence: null, source_url: null}
  _sources: {}
```

```yaml
# eateries
- slug: null
  status: ai_draft
  name_en: null
  name_mr: null
  name_hi: null
  taluka: null
  lat: null
  lng: null
  authenticity: null        # home_style|local_legend|tourist_oriented
  price_for_two: null       # ₹ int
  diet_flags: {veg: null, non_veg: null, jain: null}
  opens: null
  closes: null
  closed_days: []
  food_apps:
    swiggy: {available: null, link: null}
    zomato: {available: null, link: null}
    eatsure: {available: null, link: null}
    magicpin: {available: null, link: null}
  menu: {items: []}
  dishes: []                # [{slug: solkadhi, is_signature: true, is_best_for: false}] max 10, slugs from dishes file
  phone: null
  whatsapp: null
  description: {en: null, mr: null, hi: null}
  _sources: {}
```

```yaml
# events
- status: ai_draft
  name: {en: null, mr: null, hi: null}
  type: null                # festival|jatra|season
  from_date: null           # YYYY-MM-DD
  to_date: null
  taluka: null              # null = district-wide
  impact: {crowd: null, closures: null}   # crowd: busy|calm
  _sources: {}
```

```yaml
# utilities (hospital / police verification)
- osm_id: null              # from the OSM row being checked
  type: hospital
  taluka: null
  name: null
  phone: null
  emergency_24h: null       # not in schema (Q13)
  is_real_hospital: null    # false = clinic, mark for review
  _sources: {}
```

### 4.5 Validation rules for the import script

✓ = already enforced by `content-import/schema.ts`, the field-form schema (`lib/server/admin.ts`) or a DB constraint. **New** = required, not yet built.

| Rule | Applies to | Status |
|---|---|---|
| slug `^[a-z0-9]+(-[a-z0-9]+)*$` ≤ 60, unique in file and DB | place, stay, eatery | ✓ (places) / New (stay, eatery) |
| dish slug `^[a-z][a-z0-9_-]{1,40}$` | dish | ✓ (admin form) |
| name_en 2–120; other names ≤ 120 | all listings | ✓ |
| enum values exactly as the DB enum (category, monsoon_status, authenticity, service_style, vibe_tags, season, event type, crowd, licence) | all | ✓ places / New others |
| taluka name matches a `talukas` row; the point falls inside that taluka (`taluka_at`) | listings | ✓ |
| lat −90…90, lng −180…180 | listings | ✓ |
| opens and closes both set or both null; `HH:MM`; closed_days ∈ mon…sun | place, eatery | ✓ |
| entry_fee_inr int 0–100000; visit_minutes 10–600 | place | ✓ |
| text fields ≤ 1000 (facts), ≤ 5000 (long text) | place | ✓ |
| source_urls 1–10, `https://` only, required when desk | place | ✓ (DB check too) |
| price_max ≥ price_min ≥ 0; price_for_two ≥ 0 | stay, eatery | ✓ (DB) |
| phone `^\+?[\d\s-]{6,20}$` | stay, eatery, utility | ✓ (form) / New (import) |
| food_apps link `https://` | eatery | ✓ (form) |
| ≤ 10 dish links; every dish slug exists | eatery | ✓ (form, 10) / New (slug lookup) |
| from_month, to_month 1–12 | seasonal | ✓ (DB) |
| to_date ≥ from_date; type ∈ festival/jatra/season | events | ✓ (DB) |
| photo credit, licence and source_url all set or all empty; licence in the CC list; source_url https ≤ 500; WebP ≤ 3 MB | photos | ✓ (DB, bucket) |
| QR code `^[A-Z]{2,5}-[0-9]{3,}$` | qr | ✓ (DB) |
| audio duration 60–300 s; ≤ 10 MB | audio | ✓ (DB, bucket) |
| `status: ai_draft` → `in_review` + `verification_method: desk`; never `published` | all | ✓ (places) / New |
| every non-null fact has ≥ 1 `_sources` URL | all | New |
| `is_hidden_gem` forced false on desk rows | place | New (Q8) |
| `monsoon_reason` required when status ≠ open | place | New |
| no other listing within 150 m with a similar name (duplicate check) | listings | New |
| Devanagari script check on `*_mr` / `*_hi` fields | all translations | New |
| no phone numbers or emails inside long text | all text | New |
| reject YAML keys not in the template | all | New |

---

## 5. Summary

### 5.1 Data volume (rows to create)

| Entity | Min viable | Ideal | Basis |
|---|---|---|---|
| Places | 100 | 200 | spec range |
| Place translations (rows, en/mr/hi) | 300 | 600 | 3 per place |
| Place hours | 700 | 1,400 | 7 per place |
| Crowd typical (field) | 0 | 1,400 | 7 per place, needs visits |
| Seasonal rows | 12 | 60 | 2.3 |
| Tide links + rules | = tide-dependent places | = | unknown until collected |
| Photos (all entities) | 207 | 1,219 | 1 per listing min; 3 ideal (dishes 1) |
| Stays + translations | 45 + 135 | 90 + 270 | 2.5 |
| Eateries + translations + hours + dish links | 54 + 162 + 378 + 108 | 108 + 324 + 756 + 324 | 2 / 3 dish links each |
| Dishes + translations | 8 + 24 | 25 + 75 | 2.6 |
| Hospitals / police verified | 27 | ~160 | 2.8 |
| Events | 19 | 45 | 2.11 |
| Ready-made itineraries | 5 | 10 | 2.10 |
| QR plaques | 0 (P2) | 50 | 2.13 |
| Audio scripts | 0 (P2) | 60 | 2.14 |
| UI strings reviewed (HI + MR) | 1,626 | 1,626 | 2.15 |
| Taluka names reviewed | 18 | 18 | 2.15 |

### 5.2 Collection order

| Step | Entity | Depends on |
|---|---|---|
| 0 | Restore the hosted DB (Q2); resolve Q1, Q5, Q6 | – |
| 1 | Reference data: taluka names review, category list, `category_visit_minutes`, fuel price and mileage, correction factors | – |
| 2 | **Dishes** (D-A) | – |
| 3 | **Places** P-A identity and coordinates | 1 |
| 4 | Places P-B facts → P-C conditions (incl. seasons) | 3 |
| 5 | Places P-D EN text → review → P-E MR/HI | 4 |
| 6 | Photos for places | 3 |
| 7 | Tide link + tide rules | 3, tide-stations pipeline, M3/M4 write path |
| 8 | **Eateries** (E-A → E-B → E-C) | 2 |
| 9 | **Stays** (S-A → S-B) | 1 |
| 10 | Utilities: hospital and police verification | utility-pois pipeline |
| 11 | Pipelines: `osrm-matrix`, `embeddings` | 3, 8, 9 published |
| 12 | **Events** (next 12 months) | 1 |
| 13 | **Ready-made itineraries** | 11 |
| 14 | UI strings + emergency keywords review | – (can run in parallel) |
| 15 | Field pass: coordinates (if desk), hidden gem, crowd, amenities, network, food delivery, tide rules, verified flags | 3, 8, 9 |
| 16 | QR plaques (permissions) → audio scripts | 5, 15 |

### 5.3 Effort estimate

Assumptions (estimates, not measurements): an AI batch of 10 entries takes about 20 min including copy and paste; human checking of AI facts takes 5 min per entry; reviewing text takes 10 min per listing per language; reviewing a UI string takes 1 min; a field visit covers 6 listings per day.

| Work | Min viable | Ideal | Basis |
|---|---|---|---|
| AI batches (all entities) | ~28 h | ~58 h | 84 / 175 batches (places 5 batches per 10, eateries 3, stays 2, dishes, events, utilities 1) |
| Human fact check | ~22 h | ~52 h | 261 / 628 entries (listings, dishes, events, hospitals and police) |
| Text review EN + MR + HI | ~105 h | ~210 h | 207 / 423 listings with text × 3 languages |
| UI strings and taluka names review | ~27 h | ~27 h | 1,644 strings |
| Itineraries (plan in app) | ~5 h | ~10 h | 1 h each |
| Field days (coordinates, crowd, amenities, network, gems, tide rules, food delivery) | ~35 days | ~66 days | 207 / 398 listings ÷ 6 per day |

Split of collected fields (SYSTEM excluded, counted from the §2 tables, rounded): **≈ 40 % AI-OK, 45 % AI-DRAFT, 15 % FIELD-ONLY.**

Field-only fields are about 15 % of the fields but take most of the calendar time. They are coordinates (if Q6 = field), crowd, amenities, network, hidden gem, tide rules, verified flags and own photos. Text review is the largest block of desk hours.

---

## 6. Gaps that block import (no code changed; for planning)

| Gap | Needed for | Ref |
|---|---|---|
| YAML importer (or YAML → CSV converter) | every batch | M1, Q1 |
| Bulk import for stays, eateries, dishes, dish links, seasons, events, hospital phones | 2.5–2.11 | M2 |
| Write path for `tide_station_id` and `place_tide_rules` | 2.4 | M3, M4 |
| Write path for `place_seasonal` | 2.3 | M5 |
| HI names and HI/MR long text in import | 2.15 | M7, M8 |
| Multi-interval hours | temples, eateries | M6 |
| Per-field provenance | brief Step 4 | M9 |

---

## 7. Open questions

| # | Question | Blocks |
|---|---|---|
| Q1 | `Crabwalk Plan.md`, `Crabwalk Design.md` and `Template - Places/Stays/Food.md` aren't in the repo (CLAUDE.md §1 also lists the first two). Where are they? Should the YAML in §4.4 become the template? | template, YAML keys |
| Q2 | The hosted Supabase project is gone. Restore it or create a new one before import? | all imports |
| Q3 | Approve the proposed targets (stays 45/90, eateries 54/108, dishes 8/25, events 19/45, QR 20/50, itineraries 5/10) and the per-taluka splits. Exact place count (100–200) is still `[OPEN]`. | collection scope |
| Q4 | Per-fact `source_url`: keep it in YAML only (collapsed into `source_urls`, max 10) or add a per-field provenance store? | M9 |
| Q5 | Map `status: ai_draft` to `in_review` + `desk` (current importer behaviour)? | importer |
| Q6 | Desk coordinates: OSM / Wikidata / manual pin with field check later, or field visit only (brief: GPS is FIELD-ONLY; Report 1: no site visits)? | places, stays, eateries |
| Q7 | Long-text length targets per field (story, history, etc.) for LLM prompts. Nothing in the spec beyond ≤ 5000 chars. | P-D prompts |
| Q8 | May desk rows ever set `is_hidden_gem`, or is it verifier-only (BACKEND §3.3)? | places |
| Q9 | Eatery `vibe_tags` and `service_style`: drop from collection or define a vocabulary and display? | eateries |
| Q10 | Which `price_source` applies to a stay price found by AI on an OTA or the stay's own site? | stays |
| Q11 | May stay and eatery phone numbers be collected with external LLMs? CLAUDE.md bars phone numbers from **our** LLM payloads; collection is a separate case. | stays, eateries |
| Q12 | `stay_offers` deep links: affiliate links only, or plain OTA URLs too, before the affiliate accounts exist? | stays (P2) |
| Q13 | Store a hospital's 24 h emergency status? Not in the schema. | utilities |
| Q14 | Split hours (mid-day closing): extend the schema or accept one interval? | M6 |
| Q15 | Ready-made itinerary titles in HI/MR: single-language titles OK for launch? | M18 |
| Q16 | Fuel price and mileage: admin-set values for launch, or leave null so users enter them? | planner |
| Q17 | Are audio guides and QR plaques in launch scope, or post-launch (Report 1 lists audio after launch)? | 2.13, 2.14 |
