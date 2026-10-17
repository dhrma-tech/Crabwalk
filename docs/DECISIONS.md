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
- Marathi UI digits: Devanagari (current, Intl default) or Latin (P2-7)

## Found issues
- BACKEND §3.5 `eateries` has no contact column (phone/whatsapp), but owner fact fields include "contact" (§4, P4 task 5). Not added in P1 — needs a decision before P4.

## Phase log
| Phase | Tag | Deferred |
|---|---|---|
| P0 | `phase-0` | Supabase project + env wiring (done in P1); CI green confirmed on GitHub by user (`gh` not installed locally) |
| P1 | `phase-1` | Custom SMTP + live OTP email template (P1-19); booking-proof bucket/cleanup + verdict_agg maintenance → P5 (P1-17, P1-18) |
| P2 | `phase-2` | HI/MR string review (P2-3); published-content runtime cache → P4, taluka packs/offline banner pack status → P9, Crabby desktop panel → P8; real logo/mascot/category icons (P2-13) |
