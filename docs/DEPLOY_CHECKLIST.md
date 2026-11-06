# Deploy checklist (team verification launch, 2026-11-06)

The app is live for the team to verify data, with the temporary access gate on (`AUTH_MODE=temp_email_gate`). It is **not** the final public launch. The full runbook is `docs/DEPLOY.md`; auth restore is `docs/RESTORE_AUTH.md`; value decisions are `docs/VALUE_MAPPING.md`.

- **Live URL:** https://crabwalk.pages.dev (Cloudflare Pages project `crabwalk`, production branch `main`, direct upload; nothing pushed to GitHub)
- **Hosted DB:** Supabase project `uwaqcutysdcmxfjpfktt` (ap-south-1)

## Done

### Admin lock
- [x] Login sheet asks for email **and** team passcode; both must match (`ADMIN_EMAILS` + `ADMIN_PASSCODE`, server only).
- [x] Signed httpOnly cookie, 7 days (Secure on https). Rate limit 10 tries / 10 min per client. **Lockout:** 10 failed tries → that client is locked for 1 hour (`gate_attempts`, key = HMAC of the IP, never the IP).
- [x] Whole site `noindex` while the gate is on: `X-Robots-Tag: noindex, nofollow` header, `<meta name="robots">`, `robots.txt` → `Disallow: /`. Checked live.

### Hosted Supabase
- [x] 28 migrations applied in order (the 26 pending + `20261106130000_admin_editing` + `20261107100000_team_table_atomic_save`).
- [x] Local listings data copied (taluka ids remapped to hosted's by name; photo uploader and approver remapped to the hosted admin account). Counts match local exactly:

  | Table | Rows | Table | Rows |
  |---|---|---|---|
  | places | 171 (86 published) | place_translations | 428 |
  | stays | 85 | stay_translations | 170 |
  | eateries | 98 | eatery_translations | 196 |
  | dishes | 25 | place_hours / eatery_hours | 231 / 588 |
  | photos | 57 (+155 files, 17.7 MB) | place_seasonal / stay_offers | 11 / 32 |
  | content_drafts | 3,582 | import_audit | 456 |
  | events_calendar | 41 | utility_pois | 353 |
  | trails | 131 | road_segments_flags | 992 |
  | matrix_points / travel_matrix | 24 / 552 | taluka boundaries | 9 |

  Not copied on purpose: local test and e2e leftovers (guest trips, saves, anonymous users, rate counters, QR scans, 59 orphaned QR codes, 59 "E2E Homestay" sponsors, team Q&A test rows). Weather points and config tables were already identical on hosted.
- [x] Auth: anonymous sign-ins **on**, anonymous limit raised **30 → 1000 per hour per IP**.
- [x] Vault: `crabby_key` created (same value as the `CRABBY_SIGNING_KEY` Pages secret) so guest group chat works.
- [x] Backup before the team starts: `backups/2026-11-06T07-42-14/` (`roles.sql`, `schema.sql`, `data.sql` with auth users and storage object rows). An earlier one, taken right after the copy: `backups/2026-11-06T07-19-03/`.

### Cloudflare
- [x] Pages project `crabwalk` created (classic Pages, as configured in `apps/web/wrangler.jsonc`).
- [x] 15 production secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (the project's legacy service-role JWT: hosted Storage rejects the new `sb_secret_` key as a bearer token), `RATE_LIMIT_SALT`, `VAPID_PUBLIC_KEY`, `AGODA_ENABLED=false`, `AUTH_MODE=temp_email_gate`, `ADMIN_EMAILS`, `ADMIN_SESSION_SECRET` (new, production only), `ADMIN_PASSCODE`, `CRABBY_SIGNING_KEY` (new), `AI_MODEL_INTENT`, `AI_MODEL_EXPLAIN`, `AI_MODEL_DRAFT`, `AI_MODEL_VISION`. `AI_PROVIDER` left unset.
- [x] Live smoke test passed (19 checks):
  - guest browsing with no sign-in on `/`, a place, `/stays`, `/food`, `/taste-konkan`, `/itineraries`, `/map`, `/plan/new` and `/me`
  - admin API refuses guests
  - wrong passcode rejected
  - email + passcode → admin panel showing 171 places
  - one edit (a place's English name) saved and visible on the public page, then put back
  - Exit admin

### Code (before deploy)
- [x] Team names/emails moved off public rows into `listing_team` (staff only). DB test proves anon can't read them.
- [x] Every editor save is one transaction (`admin_apply_save`). DB test proves a partial failure writes nothing.
- [x] Value mapping: phones in the forms' 10-digit format (151 values; links add +91), Wi-Fi merged.
- [x] Checks: lint, typecheck, 363 unit tests, build. DB tests: 18 of 20 files pass; the 2 P12 files fail on missing fixtures (pre-existing, see `docs/DECISIONS.md` Found issues). Review hiding tested end to end on local, and its test data deleted.

## You need to do

1. **Add the two other admin emails**, replacing `ADMIN_EMAIL_2,ADMIN_EMAIL_3`:
   - Local: `.env.local` → the `ADMIN_EMAILS=` line, then restart `pnpm dev`.
   - Hosted: Cloudflare dashboard → Workers & Pages → **crabwalk** → Settings → **Variables and Secrets** → `ADMIN_EMAILS` → Edit → `aparadhdharmaraj@gmail.com,<email 2>,<email 3>` → Save. Then **redeploy** (secrets apply to new deployments): Deployments → latest → ⋯ → **Retry deployment**, or run the redeploy commands below.
2. Share the live URL and the team passcode with the team privately (not in the repo or a public chat).
3. Optional clean-up of what the smoke test left on hosted: 3 anonymous guest sessions, and the team row on Aare Ware Beach (`verified_by` / `last_edited_by` = your email, `last_edited_at` set). In the Supabase SQL editor:
   ```sql
   delete from auth.users where is_anonymous;   -- only before guests use the site: it also removes their saves and trips
   delete from public.listing_team where entity_type = 'place' and entity_id = 'e0ae884b-db8b-4d2d-83f1-f6c4bc4a1ce9';
   update public.places set last_edited_at = null where id = 'e0ae884b-db8b-4d2d-83f1-f6c4bc4a1ce9';
   ```

## Day to day

- **Backup now:** `pnpm db:backup` (repo root) → `backups/<timestamp>/`. Needs `SUPABASE_DB_PASSWORD` in `.env` and the CLI link (already done).
- **Restore a backup** (only to an empty project, or after you decide to overwrite):
  `psql "<connection string>" -f roles.sql`, then `-f schema.sql`, then `-f data.sql`, with the session-pooler connection string from the Supabase dashboard (Connect).
- **Redeploy after code or secret changes** (Git Bash, repo root):
  ```bash
  export SUPABASE_URL=https://uwaqcutysdcmxfjpfktt.supabase.co SUPABASE_ANON_KEY=<hosted anon key from .env> PMTILES_BASE_URL=
  pnpm --dir apps/web build
  cd apps/web && npx wrangler pages deploy .svelte-kit/cloudflare --project-name crabwalk --branch main
  ```
  (The build reads `.env.local`, which points at the local stack; the exported values win for the prerendered page.)
- **Rollback:** Cloudflare → crabwalk → Deployments → pick an older one → Rollback.

## Left for final launch

- [ ] **Restore full auth** (`docs/RESTORE_AUTH.md`): `AUTH_MODE=full`, remove the gate secrets, turn anonymous sign-ins off, SMTP + Google OAuth, Auth `site_url` / redirect URLs (still `http://127.0.0.1:5173`), remove `noindex`.
- [ ] **Hosting decision:** stay on Cloudflare Pages or move to Vercel (would need `@sveltejs/adapter-vercel`; secrets move with it).
- [ ] **Value mapping decisions** D1–D16 in `docs/VALUE_MAPPING.md` (network `good` → `ok`/`strong`, AC/hot water/power/parking levels, price source "board at reception", extra seasons, hours/crowd structure, QR permission states, menu items, entry fee "free", nullable Yes/No flags).
- [ ] **Crabby:** `GROQ_API_KEY` (and `GEMINI_API_KEY` for staff drafting) are empty, so Crabby can't answer live. Add them as Pages secrets and redeploy.
- [ ] **Map tiles:** host the PMTiles (`docs/DEPLOY.md` §5) and set `PMTILES_BASE_URL`; the live map has no basemap until then.
- [ ] **Ola proxy** Worker + `OLA_PROXY_URL` (address search fallback, directions) — DEPLOY.md §6.
- [ ] **Edge functions and crons** (weather, tides, review summaries, trip nudges, booking-proof cleanup): deploy functions, function secrets, Vault `project_url` and `cron_secret` — DEPLOY.md §2–3. Tide stations are empty (pipeline `tide-stations --live` needs `TIDECHECK_API_KEY`).
- [ ] Native review of the MR/HI strings (`apps/web/messages/NEEDS_REVIEW.md`, including `gate_*`).
- [ ] Fix the two P12 DB test fixtures (they need a published stay).
- [ ] Rotate the team passcode if it ever leaks: change `ADMIN_PASSCODE` (local + Pages) and redeploy.
