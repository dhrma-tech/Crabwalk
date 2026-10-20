# Crabwalk — Decisions log

Every `[OPEN]` resolved by the user is logged here. No dates or deadlines. Spec files are not edited; where an answer overrides a spec line, it is noted here.

## Source of truth
| Decision |
|---|
| `docs/Crabwalk Plan.md` / `docs/Crabwalk Design.md` are **not used**. Root `CLAUDE.md` + `CRABWALK_PLAN.md` + `CRABWALK_BACKEND.md` + `CRABWALK_FRONTEND.md` are the full source of truth. Spec refs to "Design §N" / "Plan §N" resolve to the matching root-file content (e.g. tokens = FRONTEND §2, layout order = FRONTEND §7, map style = FRONTEND §8). P0 task 2 "copy locked docs" dropped. |

## P0 gate answers
| # | Topic | Decision |
|---|---|---|
| G1 | Frontend framework | **SvelteKit** (shell < 200 KB + QR page). |
| G2 | Server runtime / crons | **Supabase Edge Functions + pg_cron** for all server jobs/crons. **ola-proxy = separate Cloudflare Worker** with its own `OLA_API_KEY` (physical AI firewall). |
| G3 | Hosting | **Cloudflare Pages** (free tier allows commercial). PMTiles split **per taluka (9 files)**, each < 25 MiB, = offline taluka packs. **No R2.** |
| G4 | User login | **Google OAuth + email OTP** via free SMTP (Resend or Brevo). No phone OTP. |
| G5 | Owner claim | **Email OTP + mandatory admin approval** (team calls listed number). Approval sets `profiles.role = owner` for that listing only. |
| G6 | Booking proof | Upload booking/bill screenshot → verifier queue approves/rejects → image auto-deleted after review (max 30 days). QR+GPS stays the main path. |
| G7 | Embedding model | **intfloat/multilingual-e5-small**, 384 dims. |
| G8 | Correction factors | Config table, tunable. Defaults: ghat ×1.4, coastal ×1.2, monsoon extra ×1.25; monsoon = 1 Jun–30 Sep. |
| G9 | Alert expiry | 24 h default; per-type override in config (landslide / road closure 48 h). Auto-expire unless re-confirmed. |
| G10 | "Live" crowd | ≥ 5 distinct users (scans/check-ins) in last 60 min; else "Typical". Always labelled. |
| G11 | Story font | **Mukta only.** Tiro Devanagari Marathi parked post-MVP. |
| G12 | Package manager | **pnpm workspaces.** No Turborepo. |

## Other resolutions
| Ref | Decision |
|---|---|
| A4 | Matrix: time + distance for all pairs; `route_shape` only for pairs ≤ 60 km, Douglas-Peucker simplified (~10 m), encoded polyline. Report actual size after first run. |
| A7 | OpenWeatherMap 2.5 card-free endpoints only. Confirm TidesAtlas needs no card in P3. |
| B8 | Add `regions` (`name`, `code_prefix`) + `region_id` on `talukas`. Ratnagiri = seed row. QR prefix from `regions.code_prefix`. |
| B9 | Git protocol: `git add` first, then check staged; secret scan with **gitleaks** (not grep); fill DECISIONS.md **before** commit, reference tag name (not hash); bash via Git Bash. |
| B10 | Report triage dashboard built once in P4; P6 only adds QR as a report source. |
| B11 | `/ola/*` stays login-only. Anonymous `/navigate` works for DB places (stored OSRM shapes) + "Open in Google Maps" for others. |
| B12 | Fonts = 4 files: Latin + Devanagari combined per weight (Baloo 2 600/700, Mukta 400/600). |
| B13 | No `group_type` enum change. "All" = aggregate view/query across groups. |
| C14 | QR page = same origin, server-rendered **route in `apps/web` with `csr = false`** (zero JS). **No separate `apps/qr`** (overrides PLAN §2 / P0 task 4). < 100 KB enforced in CI (P6). |
| C16 | `places.food_delivery` = which apps deliver to that location (verifier-marked, no links). `eateries.food_apps` = deep links to the eatery page. Keep both. |
| C17 | `name_*` / `reason_*` columns = `_en/_hi/_mr`. |
| C18 | GitHub repo private. User creates the Crabwalk Supabase project (pauses one of their own projects first) and sends URL/keys. Never touch other Supabase projects. Supabase CLI via `npx supabase`; user installs `gh`. |
| C19 | QR/verdict tie-break: higher level wins. |
| — | **No timeline.** No dates, deadlines or time limits. Phases run in order; a phase ends only when its acceptance criteria pass. Do not compress P10. |

## P1 pre-decisions
| Ref | Decision |
|---|---|
| P1-1 | DB testing: local Supabase via Docker Desktop (WSL2) **and** CI runs a fresh Supabase on every push. |
| P1-2 | End-to-end sign-in (Google OAuth + SMTP) is the last P1 check; everything else built first. |
| P1-3 | Edge Functions in `supabase/functions/`; `services/api/` = shared TS only; `services/ola-proxy` = separate Cloudflare Worker. |
| P1-4 | gitleaks runs in CI as well as in the local git protocol. |
| P1-5 | New tables approved: `regions`, `owner_claims`, `booking_proofs`, `alert_type_ttl`, `app_config`. |
| P1-6 | `booking_proofs` files in a private Storage bucket; pg_cron deletes the file and nulls `storage_path` after `delete_after`. |
| P1-7 | RLS defaults as proposed (public read for reference/context data; own-row for user data; internal tables staff-only; `qr_scans` / `dwell_events` server-insert only). Owners write photos, prices, menu, timings, contact for **their own listing only**; never ratings/reviews. |
| P1-8 | Roles: **no `profiles.role`**. `user_roles` (`user_id`, `role`, `taluka_id` nullable, `entity_type`/`entity_id` nullable); multiple roles per user. RLS via `has_role(role, scope)` SQL function. |
| P1-9 | `place_embeddings.embedding vector(384)`. |

## P1 implementation notes
| Ref | Note |
|---|---|
| P1-10 | Supabase project `crabwalk` (ref `uwaqcutysdcmxfjpfktt`, ap-south-1, free plan) created by Claude at user's request. |
| P1-11 | `verifier_talukas` (BACKEND §3.1) replaced by `user_roles` rows (`role = verifier`, `taluka_id`), per P1-8. |
| P1-12 | Role helpers live in a non-exposed `app` schema: `has_role(role)`, `has_role(role, taluka)`, `has_role(role, entity_type, entity_id)`. A role row with null `taluka_id` = all talukas (e.g. reviewer). |
| P1-13 | Owner fact-field rule enforced by triggers: owners may change only `price_min/max`, `price_source`, `phone`, `whatsapp` (stays) and `price_for_two`, `menu` (eateries); timings via `eatery_hours`; photos via `photos`. Only reviewers/admins can set `status = published` (trigger). |
| P1-14 | Shared trip read + guest vote implemented as RPCs `get_shared_trip(token)` / `cast_group_vote(...)` (security definer) instead of anon table access. |
| P1-15 | `content_drafts.status` = draft/approved/rejected (spec); owner claims, booking proofs, reviews use pending/approved/rejected. |
| P1-16 | Region Ratnagiri (`RTN`) + 9 talukas inserted as reference data in a migration. Hindi/Marathi taluka names need team review. |
| P1-17 | Deferred to P5 (where the booking-proof flow is built): private `booking-proofs` Storage bucket + cleanup job. Newer Supabase blocks direct SQL deletes from `storage.objects`, so the job will be pg_cron → Edge Function using the Storage API. Table exists now. |
| P1-18 | Deferred to P5: `verdict_agg` maintenance + "all" aggregate. Table exists now. |
| P1-19 | **Custom SMTP (Resend/Brevo) deferred until after the remaining phases** (user). Consequence: the live project can't use custom email templates on the free tier without custom SMTP, so the 6-digit-code template is pushed later; until then the live project sends Supabase's default email (link). Email OTP verified end-to-end on the local stack only. |
| P1-20 | Auth config is managed in `supabase/config.toml` and pushed with `supabase config push`. Local values aligned with the live project's safer defaults: email confirmations on, max 1 code/min, TOTP MFA enabled. Storage vector buckets off. |
| P1-21 | Google OAuth live on the project; verified by a real Google sign-in (profile auto-created). |
| P1-22 | CLI uses a scoped personal access token (`SUPABASE_ACCESS_TOKEN` in `.env`): Project read, Database read/write, Auth + Edge Functions read/write, Add-ons read. |
| P1-23 | SvelteKit 3 (scaffolded by `sv`): env via `src/env.ts` (`defineEnvVars`) read from repo-root `.env` (kit `env.dir`); external redirects allowlisted to the Supabase origin only. |

## P2 decisions and notes
| Ref | Decision / note |
|---|---|
| P2-1 | i18n = **Paraglide JS 2** (user). Locale order: cookie → `Accept-Language` / `navigator.languages` → `en`. Switch = form POST `/prefs` (works without JS); signed-in users also get `profiles.language` / `profiles.theme` written. Sign-in does not pull profile prefs back into the cookie (cookie wins). |
| P2-2 | **Lighthouse 12+ removed the PWA category**, so PLAN P2 acceptance "Lighthouse PWA installable" is checked with Chrome's `Page.getInstallabilityErrors` in Playwright instead (user). |
| P2-3 | HI/MR UI strings drafted by Claude (user). **All unreviewed**; tracked in `apps/web/messages/NEEDS_REVIEW.md`. |
| P2-4 | Unbuilt nav targets (Discover, Map, Crabby, Plan) show honest empty states (user). Search icon is `aria-disabled` and shows "Search arrives in a later update" — FRONTEND §4 has no search route. Plan tab → `/plan/new` (§4 has no `/plan` index). |
| P2-5 | `/me` is reachable by guests in P2 (theme + language settings + sign-in CTA). FRONTEND §4 marks Me "user"; account-only sections get gated as later phases add them. |
| P2-6 | **Override of FRONTEND §2 `--text-muted`** (user): light `#8A7A64` → `#796B58`, dark `#8F826F` → `#998B77`. The locked values failed AA (3.64–4.16:1 light; 4.02/4.49:1 dark on raised/surface). `--sponsor` and `sand-500` ramp unchanged. Enforced by `src/lib/contrast.test.ts`. |
| P2-7 | `Intl` `mr-IN` currency style drops lakh grouping (`₹१२५,०००`), so ₹ is prefixed to the decimal format (`₹१,२५,०००`). `mr` therefore shows Devanagari digits (Intl default); `en`/`hi` show Latin. |
| P2-8 | Tailwind v4: §2.1 ramps mapped in CSS `@theme` (not v3 `theme.extend.colors`). Default palette and `md`/`2xl` breakpoints removed so only brand tokens and §2.4 breakpoints exist. |
| P2-9 | Fonts: subset from google/fonts OFL sources with `subset-font` (`apps/web/scripts/subset-fonts.mjs`). Sizes: Baloo 2 600/700 ≈ 84 KB each, Mukta 400/600 ≈ 117/121 KB (Devanagari conjuncts). Licence in `static/fonts/OFL.txt`. |
| P2-10 | Component gallery `/dev/components` is served only by `vite dev` or `vite build --mode e2e` (sample data never in prod). Screenshot baselines are win32 (local); CI `e2e` job runs all other shell checks. |
| P2-11 | SvelteKit 3: service worker at `src/service-worker/` with its own tsconfig; uses `$app/manifest` + `$app/env`. Paraglide emits `.d.ts` (its JS doesn't type-check against Cloudflare `Request`). |
| P2-12 | Diet dot colours (spec silent): veg `--ok`, non-veg laterite-700, Jain mango-700 — always with a text label. |
| P2-13 | Placeholders until art: `<Crabby>` SVG, `<CategoryIcon>` Lucide glyphs, PWA icons (sand tile + laterite disc). |

## P3 decisions and notes
| Ref | Decision / note |
|---|---|
| P3-1 | **Tides: TideCheck is the default** (`TIDE_PROVIDER=tidecheck`, user). TidesAtlas free = 50 one-time credits (not ₹0-sustainable for a daily cron). Both adapters exist. TideCheck terms: cache ≤ 24 h → `tide-refresh` deletes rows not refreshed within 24 h; attribution "Tide data by TideCheck" linked, next to the data. **User to confirm with TideCheck that the free tier allows commercial use.** Overrides BACKEND §8 / FRONTEND §6.9 attribution text. |
| P3-2 | Road flags (user): ghat = drivable way named "ghat"/"घाट" or inside `pipelines/road-flags/ghat-zones.geojson` (Kashedi, Kumbharli, Amba, Anuskura — **approximate boxes, team to review**); coastal = vertex ≤ 1 km from OSM coastline. Migration adds `road_segments_flags.source` (`auto`/`team`) + `excluded` (team veto that survives re-runs). |
| P3-3 | Corrections: per segment the **larger** of ghat/coastal applies (not stacked); monsoon multiplies the whole trip when the run month is active → matrix must be re-run `--full` on 1 Jun and 1 Oct. Pairs routed with OSRM `/route` (annotations) for both raw and corrected values. |
| P3-4 | Weather points (user: I propose, team reviews): 9 taluka HQs + 9 coastal spots + 2 ghat approaches, coordinates from OSM place nodes, in migration `20261017200100`. Tide stations come from `pipelines/tide-stations` (nearest TideCheck station per coastal anchor in `region.json`). |
| P3-5 | `weather-refresh` uses OWM Current Weather 2.5 only (~480 calls/day) and keeps 7 days of `weather_cache` (spec silent on retention). Alerts-expiry cron not built in P3 (alerts arrive in P9; expiry is already defined by `expires_at`). |
| P3-6 | `ola-proxy` = Cloudflare Worker; verifies Supabase ES256 JWTs locally via JWKS; 30 req/min/user (Workers rate-limit binding); `Cache-Control: private, no-store`; normalised output with `attribution: 'ola'`. App calls same-origin `/ola/*`, which forwards the user's token (web app holds no Ola key). **Ola endpoint paths/auth taken from community clients — official reference is JS-rendered; verify on first live call.** |
| P3-7 | Tiles = extracts of the daily Protomaps build (`pmtiles extract`, maxzoom 15) instead of a local Planetiler build (no Java needed). Region file 14.2 MiB, packs 1.2–2.0 MiB. **Cloudflare Pages Range support to be verified on first deploy** (PMTiles needs 206); `wrangler pages dev` does not do Range, so dev/e2e use `pipelines/tiles/serve.ts`. Map finds its file via `${PMTILES_BASE_URL}/manifest.json` and centres from the PMTiles header (no hard-coded region). |
| P3-8 | Map labels use self-hosted Mukta through MapLibre `font-faces` (no glyph server); Devanagari conjuncts verified rendering. Basemap POI layer dropped (no sprite); our pins replace it. Labels follow `name:<lang>` → most villages show Latin because OSM lacks `name:mr` (data, not code). |
| P3-9 | Map "Open now": IST, `weekday = extract(dow)` (0 = Sunday); unknown hours never count as open; stays unaffected. Map shows `published` listings only even for staff. Ghat/warning-road and planned-route styles defined but not drawn yet (no public ghat geometry until alerts/routes, P7/P9). |
| P3-10 | AI firewall check: `scripts/check-ai-firewall.mjs` + self-test fixture, run by root `pnpm lint` (CI). AI paths: `services/api/ai/**`, `apps/web/src/lib/ai/**`, `apps/web/src/routes/api/ai/**`, `supabase/functions/ai*`. Also fails on `OLA_API_KEY` or `ola-proxy` imports anywhere outside `services/ola-proxy`. |

## P4 decisions and notes
| Ref | Decision / note |
|---|---|
| P4-1 | Eateries get `phone` + `whatsapp` (user); owner trigger allows them. Resolves the BACKEND §3.5 found issue. |
| P4-2 | Photos (user): browser resizes to WebP 480/960/1600 px + ~20 px LQIP (`photos.lqip`); **no AVIF** (browsers can't encode it reliably) — deviation from FRONTEND §3/§11. Public buckets `photos` / `audio`; path `<type>/<id>/<file>`; writes = staff for the listing or its owner (audio: reviewers/admins). Storage upserts need a SELECT policy (added). |
| P4-3 | Reports come from "Report a problem" on place/stay/eatery pages (user). No photo on reports (photos RLS is staff/owner-only). Anon abuse control: honeypot + DB throttle 20 reports/listing/hour; per-IP/user limits → P10. A report pulls the place's re-check to now. |
| P4-4 | Content (user): verifier enters facts + EN/MR names; reviewer writes EN/HI/MR text in the review screen → `content_drafts` → `approve_listing()` copies into `*_translations` and publishes. P8 AI drafts will fill the same draft rows. |
| P4-5 | **"Fixed checklist" (FRONTEND §7.15) interpreted as the fixed set of fact fields captured on every visit** (category, fee, best time, how to reach, station, bus stop, hours, crowd by weekday, monsoon, tide, hidden gem, delivery apps, notes). Spec lists no separate checklist items — confirm or supply items. |
| P4-6 | Re-check queue: places only (only `places` has `next_recheck_at`). Each verification sets it to +1 month (trigger); "Mark verified today" on /admin. |
| P4-7 | Agoda adapter behind `AGODA_ENABLED` returns null — the API call is **not implemented until partner docs/keys exist** (no guessed endpoints). Price rows: owner range ("Source: owner"), `stay_offers` links (source = affiliate network), Agoda live when enabled. Booking links are managed by admins on the stay review screen (RLS: admin write). |
| P4-8 | API shapes: `POST /api/admin/drafts/:id/approve {type}` — `:id` is the listing id. `PATCH /api/owner/listing/:id {type, …facts}`. Admin/owner pages use form actions or fetch over the same server functions. Field form ids are client-generated (idempotent offline retries). |
| P4-9 | Discover: itineraries (P7) omitted; categories filter via `/?category=`; "Near me" sorts loaded places by distance on the device. Place page: verdict gauge/reviews (P5) and similar/less-crowded (P8) omitted; nearby = stays/food/utilities within ~5 km. |
| P4-10 | Service worker: stale-while-revalidate for `/api/{places,stays,eateries,dishes,map/utilities}` (closes the P2 deferral). Not pins (open-now is time-sensitive), not tides (safety data). Admin/owner/ola never cached. |
| P4-11 | Fixed option lists where the spec ends in "…": delivery/food apps = Swiggy, Zomato, EatSure, magicpin; network operators = Jio, Airtel, Vi, BSNL. |

## P5 decisions and notes
| Ref | Decision / note |
|---|---|
| P5-1 | Review photos (user): separate `review_photos` table + public `review-photos` bucket (paths start with the uploader's id); `reviews.photo_ids` point there. Never listed as listing photos (those stay verifier/owner-only, LOCKED). Up to 4 per review, client WebP 480/960 + LQIP. |
| P5-2 | Booking proofs (user, G6): private `booking-proofs` bucket; verifier views via 10-min signed URL; image deleted on approve/reject; daily `booking-proof-cleanup` Edge Function deletes anything past `delete_after` and **auto-rejects still-pending proofs** (user can re-upload). Approval inserts `verified_visits (booking_proof)` → unlocks hygiene/cleanliness for that user + listing only. Closes P1-17. |
| P5-3 | `verdict_agg` maintained by trigger on every verdict write (closes P1-18); tie → higher level (C19); `is_new = total < 10`. "All" = view `verdict_agg_all` summing groups (B13); used by the gauge's All tab (default) and card mini bars. |
| P5-4 | Sub-score dimension/entity pairing enforced by a DB trigger; places have no sub-scores (spec lists food + stays only). Per-dimension averages via `sub_score_summary()` (individual rows stay private). |
| P5-5 | Reviews: one per user/listing/group type (unique); editing sends it back to `pending`. Moderation queue at /admin/moderation (reviewers). Nightly `review-summaries` Edge Function is a stub that writes nothing until P8 (no invented text). |
| P5-6 | Verdict buttons use Lucide icons thumbs-down / circle-minus / thumbs-up / star (spec: icon + label, no emoji). Vote group defaults to Family; the gauge defaults to All. |
| P5-7 | Owner/hygiene rules stay in RLS (P1); API maps RLS 42501 → 403 so "unverified cannot submit hygiene" is server-enforced, not just a disabled button. |

## P10 pre-decisions
| Ref | Decision |
|---|---|
| P10-1 | Order (user): finish and verify all hardening locally first; then a **guided production deploy** — user supplies keys/logins and approves every live action (wrangler login, db push, secrets, seed cleanup). |
| P10-2 | Production URL (user): Cloudflare Pages `*.pages.dev` (free); custom domain can be added later without code changes. |
| P10-3 | Privacy (user): Claude drafts the full DPDPA-oriented policy (EN/HI/MR), marked DRAFT until legal/team approval. |
| P10-4 | Fonts (perf, overrides B12 file count): each weight ships as a Latin half and a Devanagari half picked by `unicode-range`, so English pages never download Devanagari glyphs; still 4 weights. Map labels use the same halves. On English pages the हि / म switch labels use the system font. |

## P9 pre-decisions
| Ref | Decision |
|---|---|
| P9-1 | Trail difficulty (user): **easy / moderate / hard**, each with a one-line definition; OSM `sac_scale` maps automatically (hiking → easy, mountain_hiking → moderate, demanding_mountain_hiking and above → hard); team can override. |
| P9-2 | Turn cues (user: geometry cues, no street names, offline). Implemented as a **compact turn list per stored route** from OSRM maneuvers (vertex index + direction, e.g. `14L,52SR`) added by the matrix pipeline — tens of bytes per pair instead of full step JSON — so cues sit at real junctions rather than guessed bends. Ola steps only for non-DB destinations (signed in, online). |
| P9-3 | Push (user): self-generated VAPID keys (private key in `.env` / function secret, never in git); Supabase Edge Function on pg_cron every 5 min sends time nudges for trips in live mode today, max 1 push per stop; subscribe only after consent; iPhone note (installed PWA only). |
| P9-4 | Turn cues: `travel_matrix.route_turns` from OSRM maneuvers (≈ 24 bytes/route locally; region estimate low MBs). Ola Directions via our proxy returns only polyline + distance + duration, so **non-DB destinations get the route line + ETA without turn cues** (proxy unchanged). Legs without a stored shape (first leg from a station, > 60 km) show a straight guide line and make "Open in Google Maps" the primary button. |
| P9-5 | `/navigate` is a prerendered client-only page (precached with `/_app/env.js`), reading `?trip&day&leg` or `?to=lat,lng&name`. Trip routes come from `/api/trips/:id/routes` (service worker keeps the last copy; the plan page fetches it automatically). Voice = Web Speech at 400 m / 100 m per turn; wake lock re-taken on return; off-route > 60 m. Crabby's `start_nav` now opens it (closes the P8 deferral). |
| P9-6 | Offline packs: pack PMTiles + `/api/packs/:taluka/data` (published listings + safety utilities; hospital phones only) in Cache Storage `packs-v1`; the service worker answers PMTiles Range requests from it (206). Offline, the map builds its style from every downloaded pack (layers interleaved per type) and pins/hospitals come from pack data. Pack URLs/sizes/version derive from the tiles manifest (same naming as the tiles pipeline). |
| P9-7 | Heatmap (G10): `map_heatmap()` labels every point `live` (≥ `live_crowd_min_users` distinct QR sessions + consented dwell arrivals in `live_crowd_window_min`) or `typical` (crowd_typical today); no data → no point. Legend shows counts per source + the rule; points show the label from zoom 12. |
| P9-8 | Alerts (G9): verifiers report/re-confirm/remove in `/admin/alerts` (point location); `confirm_alert()` extends by `alert_type_ttl`; map shows "Reported … · expires …". Trails: `pipelines/trails` imports named OSM paths/hiking routes as `source = 'osm'` ("not yet checked by our team"); GPX built on demand. |
| P9-9 | Live trip: `trips.live_date` = live mode today. Nudges are rules on plan times (late ≥ 20 min → "skip X?" with Skip / Why? → Crabby; past planned departure → "time to leave"). Push (`trip-nudges`, every 5 min): departure within 15 min, one push per stop (`trip_stops.nudged_at`), text in the user's language, dead subscriptions (404/410) deleted. Verified locally in the edge runtime (selection + nudged_at; delivery needs a real browser subscription). |
| P9-10 | Dwell (DPDPA): opt-in in Me, revocable; RLS refuses rows without an active consent; rows carry a random per-day uuid (DB check), place and times only. Recorded only while the live-trip page is open (arrive ≤ 150 m, leave > 300 m after ≥ 5 min). Nightly `refresh_patterns()` sets `places.dwell_minutes` (median, ≥ 5 visits; planner order: verifier value → dwell → category) and `route_stats` (trending pairs in ≥ 3 saved/completed trips, 60 days; underrated = ≥ 10 votes, winner ≥ 3, rarely planned) shown on /itineraries. "Suggest a better order" (2-opt, ≥ 5 min saved, no new hours conflicts) on the plan page. |
| P9-11 | Push consent: subscribing records `consents.push`; revoking deletes every subscription (trigger). VAPID keys generated locally into `.env` (public key exposed to the web app, private key only for the function). |

## P8 pre-decisions
| Ref | Decision |
|---|---|
| P8-1 | **Overrides BACKEND §11.1 [LOCKED] router (user).** Gemini API free tier ("Unpaid Services") trains on prompts, allows human review, forbids personal info and consumer apps likely used by under-18s (ai.google.dev/gemini-api/terms, checked 2026-10-18). So: traveller-facing chat, explanations, moderation, vote merge and review summaries run on **Groq only** (`llama-3.1-8b-instant` → `llama-3.3-70b-versatile`, and 70B → 8B for explanations). **Gemini only for staff content drafting** from verifier facts (no user text). Model IDs from env. |
| P8-2 | Providers verified with a mock provider in tests (429 fall-through, payload logging); real keys + live smoke test with the other live setup (user). |
| P8-3 | Emergency keywords (BACKEND §11.6 [OPEN]): Claude drafts EN/HI/MR + romanised list in one config file, **team reviews before launch**; matching errs toward over-triggering (user). |
| P8-4 | Privacy: new `/privacy` page with only the "AI assistant (Crabby)" section in EN/HI/MR, marked draft for legal review; rest of the policy is the team's (user). |
| P8-5 | Embeddings (G7, multilingual-e5-small 384): computed in a batch pipeline for places (place-to-place similarity only — "similar" / "less crowded" need no query embedding), so no runtime embedding service. |
| P8-6 | AI code lives in `apps/web/src/lib/server/ai/` (server-only) + `supabase/functions/review-summaries` + `_shared/groq.ts`; all added to the AI firewall paths. Provider interface (Groq, Gemini, Mock) is Sarvam-ready (§11.7). |
| P8-7 | Router: on 429 / 5xx / network / missing key → next link. Every payload is scrubbed (phone numbers, coordinates) and passes an audit hook before any provider sees it. Tools return slugs/names/facts only — never ids, phones, coordinates, Ola data; trips are referenced as T1, T2… |
| P8-8 | Flow per §11.2: client emergency check → server emergency guard → `ai_take_message()` (20/IST day from `app_config.ai_daily_cap`; `AI_DAILY_MSG_CAP` env dropped) → 8B moderation → 8B tool loop (≤ 4 rounds) → 70B explanation from TOOL RESULTS only. Nothing found → honest "don't know" + 3 verified places. Client sends the last 6 turns; nothing stored server-side. |
| P8-9 | Previews: `ai_actions` (own insert as proposed; own one-way update to applied/discarded). Apply re-runs our code with the stored payload (planner, trip edit) — never the model. `start_nav` hands over to Google Maps until P9 navigation; `open_map` opens /map with `?q=` search. |
| P8-10 | Review pre-screen runs when a reviewer opens /admin/moderation (reviewer's session, ≤ 10 per load); the model only flags (`reviews.ai_flag/ai_reason`), people decide. Authors can't set flags; editing the text clears it. Content helper fills only EMPTY fields as drafts (facts minus contacts/coordinates/ids). |
| P8-11 | Nightly summaries: listings with ≥ 3 approved text reviews changed since the last summary, ≤ 40 per run, one Groq call → EN/HI/MR; stops on 429. Verified locally in the edge runtime (auth, no-key failure path); live run needs `GROQ_API_KEY` as a function secret. |
| P8-12 | Emergency card (FRONTEND §6.8): Call 112, nearest hospital from our utility POIs (distance, call if we have a number, Google Maps directions), share location (Web Share / SMS). Position stays on the device. Offline per-taluka hospital list → P9 packs. |
| P8-13 | Similar / less-crowded (place page + `/api/recommend/*`): pgvector cosine over `place_embeddings`; less-crowded = similar, ≤ 50 km, typically calm/empty today when this place is typically busy. `pipelines/embeddings` (transformers.js 4.3.0, `Xenova/multilingual-e5-small` q8) — re-run after content changes. |
| P8-14 | `AI_PROVIDER=mock` is for local dev/e2e only (also in local `.env`); the mock-log endpoint exists only in `--mode e2e` builds with mock on. **Live must leave `AI_PROVIDER` empty.** Me gains preferences (diet, budget level, group) = Crabby's memory. Desktop: bubble opens a right-side panel (closes the P2 deferral). |

## P7 pre-decisions
| Ref | Decision |
|---|---|
| P7-1 | Planner pace hours confirmed (user): relaxed 6 h, balanced 8 h, packed 10 h per day. |
| P7-2 | Visit time (user): editable config table of minutes per place category (team tunes) + optional per-place `places.visit_minutes` set by verifiers (field form). |
| P7-3 | Hours (user): places with real hours are scheduled strictly inside them. No hours rows or `hours_unknown` → only inside a daylight window (config, default 07:00–18:30), stop labelled "Hours not confirmed". |
| P7-4 | Tides (user): a tide-dependent place is planned only when it has a `place_tide_rules.max_safe_height_m` **and** tide data for that date; scheduled only inside the window where the tide stays below that height. Otherwise skipped with a "Needs tide check" note. |
| P7-5 | Entry fee (user): new `places.entry_fee_inr` (per adult, verifier-entered, null = unknown). Budget sums known fees and says how many are unknown; user can edit the line. |
| P7-6 | Fuel (user): `app_config.fuel_price_inr` + `default_mileage_kmpl`, admin-set. No price set → fuel line asks the user to enter one (no invented number). Both editable per trip. |
| P7-7 | Meals (user): lunch (12:30–14:30) and dinner (19:30–21:00) stops at published eateries near the route matching diet; cost per person = `price_for_two` ÷ 2. Breakfast assumed at the stay, not costed. |
| P7-8 | Reorder (user): `svelte-dnd-action` (MIT, touch + keyboard) plus Move up / Move down buttons; times recompute after each move. PDF (user): print stylesheet + browser "Save as PDF" (no PDF library). |
| P7-9 | Trip date (user): new `trips.start_date` (default tomorrow, IST) — spec inputs had no date but hours/tides/festivals need one. |
| P7-10 | Start point (user): railway stations + bus stands (`utility_pois`) or "Use my location"; stored in `trips.start_point` {label, lon, lat}. Later days start at the previous night's stay. |
| P7-11 | Scheduling defaults: day starts 09:00 (`app_config.planner_day_start`); place window = pace hours (lunch not counted); lunch 12:30–14:30 tried in every gap, the schedule ending earliest wins; dinner 19:30–21:00 near the last stop; meal stop 60 min. Greedy pick = score − travel ÷ 30 min, then 2-opt (never trades lunch away). Stay per night = nearest that fits 40 % of budget ÷ nights (then unknown price, then over budget). |
| P7-12 | Scores: base from verdict (winner level × 0.5, 1 if New/none); Standout +2 hidden gem, +1 calm/empty, −1.5 busy; festival with `impact.crowd = busy` in the taluka (or region-wide) counts as busy; monsoon risky −0.5 + warning; heavy rain (current OWM, trip starting today only — no forecast) −3 for risky beaches/waterfalls. Danger alerts within 1 km exclude a place. |
| P7-13 | Travel: `travel_matrix` corrected times; legs not in the matrix (start point, new listings) use straight line × 1.4 at 35 km/h. Eateries with no hours: 11:00–22:00, labelled "Hours not confirmed". |
| P7-14 | Reasons: codes → template text in EN/HI/MR saved on the stop (`reason_*`); Crabby may rephrase in P8. User edits (reorder/add/remove) are re-timed from the matrix; a stop pushed outside its hours stays and is flagged "May be closed at this time" (generation itself never does this). Edits are queued client-side so rapid taps can't race. |
| P7-15 | Custom routes: owner submits → `/admin/routes` (reviewers, via `get_route_for_review()`) → approved routes are public (trips/stops/budget RLS) and listed in `/itineraries` as "By a traveller". Ready-made = admin sets `is_ready_made` + `slug` on a trip they planned. "Plan this trip" copies stops and re-times them for the chosen date. |
| P7-16 | Group vote: no-JS form at `/plan/vote/:token`; guest id = random 90-day `cw_voter` cookie; guests see counts only (`trip_vote_counts()`), the owner sees each vote. AI merge + trade-offs → P8. |
| P7-17 | PDF: print stylesheet (app nav/top bar/offline banner hidden, all day panels shown) + browser "Save as PDF". Drag & drop: `svelte-dnd-action` pinned to 0.9.79 (0.9.80 was < 2 weeks old). |
| P7-18 | `/admin/planner`: fuel price + default mileage (blank = not set → users asked) and visit minutes per category. `/admin/events`: festivals/jatras/seasons with crowd effect + closures. Field form gains numeric entry fee + visit minutes. |

## P6 decisions and notes
| Ref | Decision / note |
|---|---|
| P6-1 | QR page JS (user): server-rendered and fully usable without JS (content, `tel:112`, report form, language switch); one inline vanilla script (< 3 KB) adds GPS visit check, location share and the scan beacon. **Narrows C14 "zero JS".** Built as a `+server.ts` returning plain HTML (`/q/[code]`), not a Svelte page: the root layout (nav, toaster, webfont CSS) always wraps pages. |
| P6-2 | Emergency (user): pinned bar = `tel:112` + "Share my location" → fresh GPS fix → Web Share with a Google Maps link + place name; no Web Share → `sms:` draft; GPS denied → shares the place's own location. Nothing stored server-side. |
| P6-3 | `/start` (user): "Start your Konkan trip" + planner CTA + honest empty itineraries slot (filled in P7) + what is near the stop. |
| P6-4 | Scan session (user): random id in a 1-day `cw_qs` cookie (path `/q`), stored only as SHA-256. One `qr_scans` row per session/code/10 min. Position sent only if geolocation is already granted (never prompts on load). Station/bus-stand codes log the scan on the redirect (no page to run the beacon). |
| P6-5 | Short codes: `create_qr_code()` (admin) = `<regions.code_prefix>-<n>`, n = max + 1 zero-padded to 3, advisory-locked per prefix. Clients can never delete codes (a deleted top number would be re-issued on a new plaque). |
| P6-6 | Verified visit: `qr_verify_visit()` computes the distance in PostGIS from the listing location; radius in `app_config.qr_visit_radius_m` (200, inclusive). One `qr_gps` visit per user/listing/day. GPS reads use `maximumAge: 0` so a retry after walking closer is not served a cached fix. |
| P6-7 | Near me now (`qr_near_me()`): 2 stays, 2 eateries, nearest fuel/ATM/toilet/hospital (PostGIS KNN, straight line) + next 3 places by corrected road time from `travel_matrix` (straight-line fallback when the listing has no matrix point). |
| P6-8 | Stay/eatery codes: verdict summary + first 30 menu items (eateries; stays have no menu column) + latest 3 approved reviews + "Leave a review" → listing page (sign-in + vote UI live there). No payments. |
| P6-9 | Size budget: CI unit test renders the page with long Devanagari content and fails if HTML ≥ 40 KB (leaves ≥ 60 KB for the 480 px WebP hero), > 1 script, any external script/CSS, webfont or SvelteKit marker. Local e2e measures the real transfer (< 100 KB). |
| P6-10 | Plaque: `/admin/qr/:code/plaque` = printable A5 SVG (EN + MR name, QR → `<origin>/q/<code>`, URL text, "Emergency 112" band); QR via `uqr` (MIT). Short URL host = the origin the admin is on — generate plaques from the production site. Sponsor = free-text name (find-or-create in `sponsors`), display only. |
| P6-11 | Audio guide slots: QR page uses the native `<audio>` player (UI language → EN fallback); upload path is the P4 review screen. TTS generation waits on the Sarvam result. |
| P6-12 | Not on the scan page yet: active `alerts` (no data until P9 — add to the safety block then); live crowd display from `qr_scans` (P9 live layers). |

## Pending (not blocking code)
- Sarvam AI result (Suhani) — provider interface ready (P8-6)
- Ola caching confirmation email to support@olakrutrim.com (client cache = active session until confirmed)
- Plaque permissions (ASI / temple trusts / gram panchayats) — recorded per code in /admin/qr (P6)
- Affiliate account owner (PAN/bank)
- Logo + Crabby mascot artist
- Custom category icon set
- Exact place count (100–200)
- TBD rating — parked, do not build
- Per-spot tide accessibility rule — from verifiers
- Emergency keyword list EN/HI/MR — Claude draft in P8, team to review before launch (P8-3)
- Custom SMTP + push OTP email template to live project (P1-19) — after remaining phases
- Hindi/Marathi taluka names — team review (P1-16)
- HI/MR UI strings — team review before launch (P2-3, `messages/NEEDS_REVIEW.md`)
- Field-form checklist items, if different from the fact fields (P4-5)
- Marathi UI digits: Devanagari (current, Intl default) or Latin (P2-7)

- Ready-made itineraries (~5) — team plans them in the app, admin flags them (P7-15)
- Fuel price, default mileage, visit minutes per category — team sets in /admin/planner (P7-6, P7-2)

- Privacy policy (rest of it) + legal review of the AI section (P8-4)

## Found issues
- ~~OSRM pipeline: corrected duration floored at the segment sum, not the route duration (turn penalties), so corrected < raw failed the pipeline once more points existed~~ — fixed in P9 (it blocked the turn-cue run): penalties kept, floor = route duration; test added.
- Supabase grants EXECUTE to PUBLIC by default, so `revoke … from anon, authenticated` alone does not block a function. Fixed for `refresh_patterns` in P9; earlier revokes (`create_qr_code`, `qr_verify_visit`, `ai_take_message`, `get_route_for_review`) are still guarded inside the functions (admin/auth checks) — revisit in P10 hardening.
- ~~BACKEND §3.5 `eateries` has no contact column~~ — resolved in P4 (P4-1).
- ~~`rls.test.sql` test 29 counted every approved review → failed on a local DB with P5 e2e leftovers~~ — fixed after P6 (user): scoped to its fixture place. Same fix for `p6_qr.test.sql` "next spot" (fixture moved within ~70 m so leftover e2e places can't outrank it). In P7 the trip assertions in `rls.test.sql` were scoped to the fixture trip too (approved e2e routes are public).
- `e2e/shell.test.ts` "works offline after first visit" timed out once under a full parallel run (passes alone and on rerun) — possible flake.

## Phase log
| Phase | Tag | Deferred |
|---|---|---|
| P0 | `phase-0` | Supabase project + env wiring (done in P1); CI green confirmed on GitHub by user (`gh` not installed locally) |
| P1 | `phase-1` | Custom SMTP + live OTP email template (P1-19); booking-proof bucket/cleanup + verdict_agg maintenance → P5 (P1-17, P1-18) |
| P2 | `phase-2` | HI/MR string review (P2-3); published-content runtime cache → P4, taluka packs/offline banner pack status → P9, Crabby desktop panel → P8; real logo/mascot/category icons (P2-13) |
| P3 | `phase-3` | **User: API keys + live setup after all phases.** Deferred: `wrangler login` → tiles deploy to `crabwalk-tiles` + verify Pages Range (P3-7) + `PMTILES_BASE_URL`; `ola-proxy` deploy + `OLA_API_KEY` secret + endpoint verification (P3-6) + `OLA_PROXY_URL`; OWM/TideCheck keys → `tide-stations` run, Edge Function deploy + secrets, Vault secrets on live, real cron rows + tide attribution with live data; push P3 migrations to live + pipelines `--live`; TideCheck commercial-use email (P3-1); ghat-zone review (P3-2). Verified locally only. |
| P4 | `phase-4` | AI drafting → P8 (stubbed via content_drafts); verdict gauge/reviews → P5; itineraries → P7; similar/less-crowded → P8; Agoda API call (needs partner docs/keys, P4-7); per-IP rate limits → P10; photo delete/reorder UI; HI/MR review of new strings; live: push P4 migrations + storage buckets with the other live setup. |
| P5 | `phase-5` | Review moderation model + nightly summaries → P8 (stubs in place); QR+GPS verified visits → P6 (booking proof path live); live: P5 migrations, buckets, cleanup/summary functions + cron with the other live setup; HI/MR review of new strings. |
| P6 | `phase-6` | Alerts on scan page + live crowd from scans → P9 (P6-12); ready-made itineraries on /start → P7; per-IP rate limits on scan/report → P10; HI/MR review of new strings; live: P6 migration with the other live setup; plaques must be generated from the production origin. |
| P7 | `phase-7` | AI vote merge + trade-offs and reason rephrasing → P8; pattern analysis (dwell, trending/underrated) → P9; **ready-made itinerary content: 0 rows until the team plans and flags them (~5)**; fuel price + mileage + visit minutes to be set by the team in /admin/planner; HI/MR review of new strings; live: P7 migration with the other live setup. |
| P8 | `phase-8` | **Live:** `GROQ_API_KEY` + `GEMINI_API_KEY` (web + review-summaries secret), model IDs, run `pipelines embeddings --live`, P8 migration, review-summaries cron; real-LLM smoke test (P8-2). Emergency keywords + privacy AI section + all P8 HI/MR strings need team/legal review before launch. Offline hospital list → P9; navigation for `start_nav` → P9. |
| P9 | `phase-9` | **Live:** VAPID keys as `trip-nudges` secrets + `VAPID_PUBLIC_KEY`/`VAPID_SUBJECT` in the web env; deploy `trip-nudges`; P9 migration (crons `trip-nudges`, `refresh-patterns`); re-run `osrm-matrix --full` (turn cues) and `trails` pipelines `--live`; tiles deploy for packs. Real-device checks: push delivery (Android + installed iPhone PWA), wake lock, voice. Team: verify OSM trails (difficulty), alert workflow. HI/MR review of P9 strings. |
