# Temporary access gate + full admin data editing

Date: 2026-11-06. Two rounds: (1) the gate and the editor, built and tested locally; (2) hardening and **go-live for team verification** at **https://crabwalk.pages.dev**. Nothing was pushed to GitHub (the deploy is a direct upload). Every gate change point is marked `TODO(before-deploy): restore full auth`.

Related docs:
- [`docs/DEPLOY_CHECKLIST.md`](docs/DEPLOY_CHECKLIST.md): what was deployed, what you still need to do, what's left for final launch
- [`docs/RESTORE_AUTH.md`](docs/RESTORE_AUTH.md): how to turn full login back on
- [`docs/VALUE_MAPPING.md`](docs/VALUE_MAPPING.md): field forms vs app values
- `docs/DECISIONS.md` → "Temporary access gate + admin editing" (AG-1…AG-11)

## Round 2: go-live hardening (2026-11-06)

| # | Change | Proof |
|---|---|---|
| 1 | **Admin lock.** The login sheet asks for email + team passcode; both must match `ADMIN_EMAILS` and `ADMIN_PASSCODE` (server only, constant-time compare). The 7-day cookie and the 10-per-10-minute rate limit stay. 10 failed tries from one client lock it out for 1 hour (`gate_attempts`, keyed on an HMAC of the IP). Whole site `noindex`: header, meta tag and `robots.txt` `Disallow: /` while the gate is on. | Unit tests (passcode); DB tests (lockout); local endpoint run: 9 × denied, then 429 on the 10th; live: wrong passcode rejected, robots and header checked |
| 2 | **Hosted Supabase.** All 28 pending migrations applied. Local listings data copied (171 places, 85 stays, 98 eateries, 25 dishes, 57 photos + 155 files, all related rows), counts identical. Anonymous sign-ins on, limit 30 → 1000/hour/IP. Vault `crabby_key` added. Backup script `pnpm db:backup`; backup taken before the team starts. | Count comparison of 20 tables; backup row counts checked |
| 3 | **Deploy.** Cloudflare Pages project `crabwalk` (as configured), 15 production secrets, live at https://crabwalk.pages.dev. No GitHub push needed. | Live smoke test, 19 checks |
| 4 | **Team emails off public rows.** `verified_by` / `reviewed_by` / `last_edited_by` moved to the staff-only `listing_team` table (cleaner than column grants: `select('*')` keeps working, new columns can't leak). | `supabase/tests/admin_editing.test.sql`: anon and signed-in guests get "permission denied" on `listing_team` / `listing_private` / `listing_form`, and the columns no longer exist on the listing tables |
| 5 | **Value mapping.** Exact 1:1 mappings applied: phones → the forms' 10 digits (151 values; call/WhatsApp links add +91 back, `lib/phone.ts`); Wi-Fi merged into `amenities.wifi`. 16 unclear ones left as they are, for your decision. | `docs/VALUE_MAPPING.md`; `lib/phone.test.ts` |
| 6 | **AppNav fix** kept. | — |
| 7 | **Atomic saves.** Every editor save, status change, archive and create is one Postgres transaction (`admin_apply_save`), version check included. | DB test: a save whose last part fails (bad opening-hours row) leaves the listing row, translation, form answers, private fields, team row and version all unchanged |
| 8 | **Admin emails.** Placeholders `ADMIN_EMAIL_2`, `ADMIN_EMAIL_3` left in place (entries without `@` are ignored). Where to set them: `docs/DEPLOY_CHECKLIST.md` → "You need to do". | — |
| 9 | **Review hiding** tested end to end on local: a test reviewer, review and photo; the admin hid the text and photo in the editor; the public page and anon REST no longer showed them; showing again worked; all test data deleted. Nothing created on hosted. | 10 checks |

New files this round:
- `supabase/migrations/20261107100000_team_table_atomic_save.sql`
- `supabase/tests/admin_editing.test.sql`
- `apps/web/src/lib/phone.ts`, `apps/web/src/lib/phone.test.ts`
- `scripts/backup-db.mjs` (`pnpm db:backup`)
- `docs/VALUE_MAPPING.md`, `docs/DEPLOY_CHECKLIST.md`

Changed this round:
- Gate: `gate.ts` (passcode), `auth/admin/+server.ts` (lockout), `AdminGate.svelte` (passcode field), `rate.ts` (`clientKey`)
- noindex: `hooks.server.ts`, `robots.txt`, root `+layout.svelte`
- `content.ts` (team table, atomic plan), `fields.ts` (team keys, Wi-Fi)
- `Contact.svelte` (phone links); `listings.ts` (strip no longer needed)
- `env.ts`, `.env.example`, `.gitignore` (`backups/`), `package.json`, `messages/*.json` (`gate_passcode`, `gate_locked`), `db.types.ts`
- Docs: `RESTORE_AUTH.md`, `DECISIONS.md`

## Round 1 details

## What changed

### Task 1: email gate (`AUTH_MODE=temp_email_gate`)
- **Guests:** no sign-in anywhere. The first page view gives each visitor a Supabase **anonymous session** (crawlers excluded). Saves, trips, the planner, group chat, votes, reviews, journal and Crabby work unchanged under RLS. The per-user AI daily cap is keyed on that guest id. `/login` redirects to the gate; staff pages send guests to the gate instead of the login page.
- **Login toggle:** "Sign in" on **Me** (same place as before) opens a sheet with one email field and Continue.
  - On `ADMIN_EMAILS` (trimmed, case-insensitive) → admin session, then the admin panel. The header shows an **Admin** pill and **Exit admin** (on phones, in a slim row under the bar).
  - Not on the list → "This email doesn't have admin access"; the visitor carries on as a guest.
- **Security:**
  - The allowlist is checked only in `POST /auth/admin`, which is rate-limited to 10 tries per 10 minutes per client.
  - On success the server sets a signed httpOnly cookie `cw_admin` (HMAC-SHA256 with `ADMIN_SESSION_SECRET`, 7 days, holds the email).
  - Every admin page and admin API verifies the cookie server-side. The check also re-reads the current allowlist, so removing an email cuts access at once.
  - The server then starts a real Supabase session for that email (`app_metadata.temp_admin`, admin role row). Existing admin pages and their RPCs (`approve_listing`, `create_qr_code`, …) keep working under RLS. The hook signs that session out once the cookie is invalid, expired or off the list.
  - The editor writes with the **service role**, only after the cookie check. RLS for anon/authenticated was not loosened anywhere; three read policies were made stricter.
  - All three admin emails have equal, full powers. Role, verifier and owner logic is untouched for `AUTH_MODE=full`.

### Task 2: admin panel edits all data (`/admin/content`, `/admin/tables/*`)
- **Fields:**
  - Places, stays, eateries and dishes cover every DB column; a test checks this against `db.types.ts`.
  - They also cover every question of the Drive field forms (Places STANDARD, Stays and Hotels, Food).
  - Input types: text, long text, Devanagari text, enum dropdowns with the forms' exact options, multi-selects with limits (vibe tags max 4), numbers, whole-rupee money, 1-decimal km, tri-state Yes / No / Unknown (Unknown = null), HH:MM, YYYY-MM-DD, month chips.
  - GPS has 6 decimals, "Use my location" and a draggable map pin.
  - Repeating rows: opening hours, seasons, crowd, nearby utilities, room types, booking links, signature dishes, menu items, "where it's best".
- **Completeness:** each entry shows its empty required fields (the forms' `*` items, photo-slot minimums, required rows) and a % complete; empty required fields are highlighted. The list can filter by type, taluka, category, status, archived and "missing required fields", and sort by completeness.
- **Workflow:**
  - draft → ready for review → approved. Marking ready with gaps first shows the list of what's missing.
  - Any admin can approve any entry, including their own.
  - `verified_by` / `verified_on` are filled from the admin email and today when empty (still editable). `reviewed_by` / `reviewed_on` are filled on approve.
  - Next check due is visit + 1 month for places, + 3 months for stays and eateries.
- **Remove:**
  - **Archive** hides the entry from the public site, lists it under the Archived filter, and restores in one tap.
  - **Delete forever** asks you to type the entry's name or ID. It removes the entry, its photo files and rows, and every related row: links, QR codes and their scans and reports, ratings, saves, trip stops.
- **Validation:** ID formats `<REGION>-P/S/F-###` (region prefix comes from data, not code) and `DISH-###`, GPS, 10-digit phones (typed `+91 …` is cleaned to 10 digits), whole rupees, enums, https links. Errors show inline, and only errors on the fields you changed block Save.
- **Photos:** upload, replace, remove, reorder, and move between the forms' slots. Files are compressed on the device (WebP) into the existing `photos` bucket, and file names follow the forms (`RTN-P-001_hero.jpg`, `…_room01.jpg`, `DISH-001_01.jpg`).
- **Private fields:** `owner_phone`, `internal_notes` and `source_notes` are labelled **Private**. They live in `listing_private`, which has RLS on and no policies, so no public query can read it. Checked: the public stay API and page exclude them.
- **Relations:** searchable dish ↔ eatery pickers; a warning when a linked entry is missing or archived.
- **Reviews:** hide or show review text and review photos. Votes and verdicts can't be edited.
- **Last editor:** "Last edited by X on <date>" on every entry and in the list.
- **Concurrent edits:** saves send only the changed fields, plus the `updated_at` they were loaded at. If someone saved in between, nothing is written. You see their changes ("you changed this too" where you both edited) and choose: load theirs with your edits on top, or discard yours.
- **Other content tables**, built from the live schema: alerts, verified team Q&A, user reports, ready-made itineraries (published routes), QR plaques, events, utility points. All support create, edit and delete; events also support archive.
- **UX:** list + edit panel side by side on laptops. On phones: one column, sticky Save above the nav, 44 px+ targets. Unsaved-changes warning on both. Crabwalk tokens only.

## Files

**New**
- `apps/web/src/lib/server/gate.ts`: allowlist, HMAC cookie
- `apps/web/src/lib/server/guest.ts`: guest sessions hook
- `apps/web/src/lib/server/adminSession.ts`
- `apps/web/src/lib/server/service.ts`: service-role client
- `apps/web/src/lib/server/content.ts`: editor read/save/workflow/photos/delete
- `apps/web/src/lib/server/tables.ts`: generic table editor
- `apps/web/src/lib/admin/fields.ts`, `validate.ts`, `tables.ts`: field definitions, validation, completeness
- `apps/web/src/lib/components/AdminGate.svelte`, `AdminBadge.svelte`
- `apps/web/src/lib/components/admin/Editor.svelte`, `FieldInput.svelte`, `GpsInput.svelte`, `RowsEditor.svelte`, `Picker.svelte`, `PhotoSlots.svelte`
- `apps/web/src/routes/+layout.server.ts`
- `apps/web/src/routes/auth/admin/+server.ts`
- `apps/web/src/routes/admin/content/**`, `apps/web/src/routes/admin/tables/[table]/**`
- `apps/web/src/routes/api/admin/content/**`, `apps/web/src/routes/api/admin/tables/**`
- Tests: `apps/web/src/lib/server/gate.test.ts`, `guest.test.ts`, `apps/web/src/lib/admin/fields.test.ts`
- `supabase/migrations/20261106130000_admin_editing.sql`
- `docs/RESTORE_AUTH.md`, this file

**Changed**
- `apps/web/src/hooks.server.ts`: `getUser()` memoised per request; guest hook added
- `apps/web/src/lib/server/auth.ts`: temp-mode branches in `session()` / `requireStaff()`
- `apps/web/src/env.ts`, `.env.example`: new env vars
- `apps/web/src/lib/server/rate.ts`: gate rate limit
- `apps/web/src/lib/server/listings.ts`: `getStay` strips the team-email columns from the public API
- `apps/web/src/routes/me/*`: sign-in toggle opens the sheet; guest trips and saves shown
- `apps/web/src/routes/login/+page.server.ts`: redirect and OTP/Google off in temp mode
- `apps/web/src/routes/admin/+page.svelte`: "Edit all content" link
- `apps/web/src/lib/components/TopBar.svelte`: Admin indicator
- `apps/web/src/lib/components/map/MapView.svelte`: optional draggable pin, additive props
- `apps/web/src/lib/components/AppNav.svelte`: one-line bug fix, see below
- `apps/web/src/lib/db.types.ts`: regenerated
- `apps/web/messages/en|mr|hi.json`: `gate_*` keys; HI/MR drafts listed in `NEEDS_REVIEW.md`
- `supabase/config.toml`: anonymous sign-ins on
- `docs/DECISIONS.md`

## Env vars to set (server only, `.env.local` / host env)

| Var | Value |
|---|---|
| `AUTH_MODE` | `temp_email_gate` now; `full` to restore login |
| `ADMIN_EMAILS` | `aparadhdharmaraj@gmail.com,ADMIN_EMAIL_2,ADMIN_EMAIL_3`: replace the two placeholders (entries without `@` are ignored) |
| `ADMIN_SESSION_SECRET` | 32+ random bytes (one is already generated in your local `.env.local`) |
| `ADMIN_PASSCODE` | team passcode (round 2), same value locally and on Cloudflare; rotate by changing both and redeploying |
| `SUPABASE_SERVICE_ROLE_KEY` | already in `.env`; `.env.local` now holds the **local stack's** key, because `.env.local` points `SUPABASE_URL` at the local stack |

Also needed: **anonymous sign-ins on** in Supabase Auth (local: done in `config.toml`; hosted: Dashboard → Authentication → Sign In / Providers).

## Database changes

Migration `20261106130000_admin_editing.sql` is additive. No table or column was dropped or renamed, and no row was deleted, except the walkthrough's own test entries, deleted through the feature.
- `places`, `stays`, `eateries`, `dishes`: `code` (unique, format-checked), `verified_by`, `reviewed_by`, `reviewed_on`, `last_edited_by`, `last_edited_at`, `archived_at`, `archived_status`.
- `stays` and `eateries` also get `next_recheck_at`.
- `dishes` also get `status` (existing dishes = `published`) and `last_verified_at`.
- `photos`: `slot`, `sort_order`, `file_name`. `eatery_dishes`: `note`. `review_photos`: `hidden_at`.
- New staff-only tables (RLS on, no policies): `listing_form` (form answers with no column) and `listing_private` (private fields).
- Stricter read policies: draft or archived dishes are hidden from the public; hidden review photos are hidden from the public. `app.listing_published` now checks dish status.
- Service-role-only functions: `admin_delete_listing`, `admin_table_columns`.

**Applied to:** the local stack (round 1) and the hosted project (round 2, with all earlier pending migrations). Round 2 then moved `verified_by` / `reviewed_by` / `last_edited_by` into `listing_team` (migration `20261107100000`).


## Verification
- `pnpm lint` (Prettier, ESLint, AI firewall, env guard) ✔. `pnpm typecheck`: 0 errors, 0 warnings. `pnpm build` ✔.
- `pnpm test`: 357 passed. New tests:
  - admin email accepted with case and space variants; other emails rejected
  - forged, expired and off-list cookies rejected
  - every admin API returns 401 without the cookie; admin pages redirect to the gate
  - guests get a session for saves, trips, chat and reviews with no login
  - crawlers get no account
  - field coverage of every DB column, and validation rules
- `supabase test db`: 17 of 19 files pass. `p12_crabby` and `p12_push_queue` fail because they need a published stay and the cleaned local DB has none (DI-13). This was already the case before this change; logged in Found issues.
- Browser walkthrough (Playwright, dev server + local stack, phone and laptop), ~100 checks, all passing:
  - **Guest:** browse, save, plan a trip, trip workspace, group chat, journal, Crabby chat with no sign-in.
  - **Non-admin email:** denied; still a guest.
  - **Admin login** with ` APARADHDHARMARAJ@gmail.com ` (mixed case, spaces): cookie is httpOnly with 7-day expiry, and the allowlist is not in the page.
  - **Editing:** one test place, stay, eatery and dish touching every input type, plus validation errors.
  - **Workflow:** draft → ready (missing-fields warning) → approved (own entry), then archive (gone from the public API) and restore.
  - **Photos:** upload, names, reorder, replace, remove.
  - **Links:** dish ↔ eatery picker and the archived-link warning.
  - **Public output:** the stay API and page don't contain the private fields or team emails; a draft dish is hidden from guests.
  - **Conflicts:** two admins on one entry → conflict shown, nothing overwritten, explicit merge keeps both edits. The unsaved-changes warning blocks leaving.
  - **Other tables:** the generic table editors open.
  - **Delete forever:** the typed name is required. Each test entry was removed with its photos, files and related rows.
  - **Exit admin:** cookie cleared, panel closed, back to a guest.

## Open items and decisions (current)
1. **Your admin emails:** replace `ADMIN_EMAIL_2,ADMIN_EMAIL_3` locally and on Cloudflare, then redeploy (steps in `docs/DEPLOY_CHECKLIST.md`).
2. **Value mappings D1–D16** (`docs/VALUE_MAPPING.md`) need your call; until then the editor keeps both the form answer and the app value where they differ.
3. **Smoke-test leftovers on hosted:** 3 anonymous guest sessions, and the team row on Aare Ware Beach (`verified_by` / `last_edited_by` = your email). Restoring them needed deletes, which I didn't run; the SQL is in the checklist if you want them gone. The visible change (the name) was put back through the editor.
4. **Not live yet:**
   - Crabby: no Groq key in `.env`
   - map tiles: no hosted PMTiles
   - Ola proxy
   - edge functions and crons
   - Auth `site_url`

   Listed under "Left for final launch" in the checklist.
5. **Final launch:** restore full auth, and decide Cloudflare vs Vercel.
6. Pre-existing: the two P12 DB test files need a published-stay fixture.
7. Editor labels are English only (staff tool). The guest-facing gate strings are EN/MR/HI, with MR/HI awaiting native review.
