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

## Found issues
_None yet._

## Phase log
| Phase | Tag | Deferred |
|---|---|---|
| P0 | `phase-0` | Supabase project + env wiring (awaiting user's URL/keys); CI green confirmed on GitHub by user (`gh` not installed locally) |
