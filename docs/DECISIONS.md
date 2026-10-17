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

## Pending (not blocking code)
- Sarvam AI result (Suhani)
- Ola caching confirmation email to support@olakrutrim.com (client cache = active session until confirmed)
- Plaque permissions (ASI / temple trusts / gram panchayats)
- Affiliate account owner (PAN/bank)
- Logo + Crabby mascot artist
- Custom category icon set
- Exact place count (100–200)
- TBD rating — parked, do not build
- Planner pace hours (DEFAULT relaxed 6 / balanced 8 / packed 10) — confirm before P7
- Trail difficulty scale — before P9
- Per-spot tide accessibility rule — from verifiers
- Emergency keyword list EN/HI/MR — team to finalize before P8
- Custom SMTP + push OTP email template to live project (P1-19) — after remaining phases
- Hindi/Marathi taluka names — team review (P1-16)
- HI/MR UI strings — team review before launch (P2-3, `messages/NEEDS_REVIEW.md`)
- Field-form checklist items, if different from the fact fields (P4-5)
- Marathi UI digits: Devanagari (current, Intl default) or Latin (P2-7)

## Found issues
- ~~BACKEND §3.5 `eateries` has no contact column~~ — resolved in P4 (P4-1).

## Phase log
| Phase | Tag | Deferred |
|---|---|---|
| P0 | `phase-0` | Supabase project + env wiring (done in P1); CI green confirmed on GitHub by user (`gh` not installed locally) |
| P1 | `phase-1` | Custom SMTP + live OTP email template (P1-19); booking-proof bucket/cleanup + verdict_agg maintenance → P5 (P1-17, P1-18) |
| P2 | `phase-2` | HI/MR string review (P2-3); published-content runtime cache → P4, taluka packs/offline banner pack status → P9, Crabby desktop panel → P8; real logo/mascot/category icons (P2-13) |
| P3 | `phase-3` | **User: API keys + live setup after all phases.** Deferred: `wrangler login` → tiles deploy to `crabwalk-tiles` + verify Pages Range (P3-7) + `PMTILES_BASE_URL`; `ola-proxy` deploy + `OLA_API_KEY` secret + endpoint verification (P3-6) + `OLA_PROXY_URL`; OWM/TideCheck keys → `tide-stations` run, Edge Function deploy + secrets, Vault secrets on live, real cron rows + tide attribution with live data; push P3 migrations to live + pipelines `--live`; TideCheck commercial-use email (P3-1); ghat-zone review (P3-2). Verified locally only. |
| P4 | `phase-4` | AI drafting → P8 (stubbed via content_drafts); verdict gauge/reviews → P5; itineraries → P7; similar/less-crowded → P8; Agoda API call (needs partner docs/keys, P4-7); per-IP rate limits → P10; photo delete/reorder UI; HI/MR review of new strings; live: push P4 migrations + storage buckets with the other live setup. |
