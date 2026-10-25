# Crabwalk: Report 1. What's left to build, fix and improve

> Scope: the whole repo at `E:\CODEBASE\Crabwalk` on branch `refinement` (HEAD `b5391ec` plus uncommitted work), checked against `CRABWALK_PLAN.md`, `CRABWALK_BACKEND.md`, `CRABWALK_FRONTEND.md`, `docs/DECISIONS.md`, `AUDIT.md`, `docs/DEPLOY.md` and the product USP doc.
> Method: I read the code and docs. I did **not** re-run the test suites for this report. Numbers quoted from `AUDIT.md` are its last recorded run.
> Legend: **P0** blocks launch · **P1** fix before real users · **P2** improve soon · **P3** nice to have. `[ASK]` means it needs a decision from you before anyone builds it (CLAUDE.md §1: spec silent = `[OPEN]`).

---

## 0. Where things stand

| Area | State |
|---|---|
| Phases | `phase-0` … `phase-9` and `phase-10a` are tagged. `phase-10` and `v1.0.0-mvp` are **not** tagged. The P10 hardening commit `836df36` is on `main` but has no tag. |
| Branches | `main` = `origin/main` (`2ff0826`). `refinement` is **11 commits ahead of main and has never been pushed** (there is no `origin/refinement`). |
| Working tree | 12 modified files and 2 untracked (`apps/web/src/lib/devAuth.ts`, `.vscode/`). These are a card/grid restyle of Discover, the dev auth bypass, and the R-8 decision. |
| Quality bar (AUDIT.md) | lint ✓, typecheck ✓, 155 unit, 245 DB (pgTAP), 61 e2e, build ✓. Lighthouse: 93–100 on every page except `/map` (31 mobile, 61 desktop). |
| Live environment | **Nothing is deployed.** Every phase from P3 on lists its live setup as deferred (DECISIONS phase log). The production database has only the P1/P2 state. |
| Content | 0 ready-made itineraries. The place count target is 100–200. The team collects data **from the internet, with no site visits, one photo per place**. The app's data model assumes field visits (see §2). |

Bottom line: the code is close to feature-complete and well tested. What blocks launch is (a) getting refinement merged and the live deploy done, (b) a content pipeline that matches how the team actually collects data, and (c) honesty and licensing issues that this way of collecting creates.

---

## 1. Release blockers (P0)

### 1.1 Land the refinement branch
- **Problem:** 11 commits plus uncommitted work exist only on your laptop. A disk failure would lose them. `main` (and CI) haven't seen the refinement fixes.
- **Do:**
  1. Decide on `.vscode/`: add it to `.gitignore` or commit only `extensions.json`.
  2. Commit the working tree in two commits: `feat(dev): local auth bypass` (devAuth + env + hooks + auth + me + layout + `.env.example`) and `style(discover): hairline card grid` (cards, itineraries, Discover, app.css input focus, R-8 log).
  3. Push `refinement`, open a PR into `main`, let CI pass, then merge with a merge commit. Don't force-push.
- **Verify:** `git status` is clean, CI is green on the PR, and `git rev-list --count main..refinement` = 0 after the merge.

### 1.2 Guarded dev auth bypass (check before merge)
`lib/devAuth.ts` is gated by `dev && !import.meta.env.PROD && DEV_BYPASS_AUTH==='true' && localhost`. That's good. Close the remaining gaps:
- Add a unit test that `devBypass()` returns `false` when `PROD` is true or the host is anything other than localhost/127.0.0.1.
- Add a CI check that fails if any committed env file sets `DEV_BYPASS_AUTH=true`.
- `devAuth.ts` imports `toast.svelte.ts` (client state) into a module loaded by `hooks.server.ts`. Split it into `devAuth.server.ts` (the hook and roles) and `devAuth.client.ts` (the toast and fetch wrapper) so server bundles never pull in client code.
- The `DEV MODE` badge uses `font-bold` and raw `text-[11px]`. That's fine for a dev-only badge, but exclude it from the clip check and snapshots.

### 1.3 Guided production deploy (`docs/DEPLOY.md` §0–§10)
Every item below is deferred in the DECISIONS phase log, and none of it is done:

| # | Step | Owner input needed |
|---|---|---|
| a | `supabase db push` for P3 → refinement migrations (`20261025100000_refinement_indexes` is the last) | DB password |
| b | Vault secrets `project_url` and `cron_secret` | `CRON_SECRET` |
| c | Custom SMTP (Resend/Brevo) + the 6-digit OTP template (P1-19). **Until this is done, email sign-in and owner-claim OTP send Supabase's default link email**, and owner claims are stuck. | SMTP account, sender |
| d | Deploy 5 Edge Functions + secrets (weather, tide, proofs cleanup, review summaries, trip nudges) | OWM, TideCheck, Groq, VAPID |
| e | Pipelines `--live`: utility POIs, road flags, OSRM `--full`, tide stations, trails, embeddings | none (laptop + Docker) |
| f | Tiles deploy to `crabwalk-tiles` + **verify a 206 Range response** (P3-7). Without 206, the map breaks in production. | `wrangler login` |
| g | `ola-proxy` Worker deploy + `OLA_API_KEY`. **Endpoint paths came from community clients**, so verify them on the first live call (P3-6). | Ola key |
| h | Pages env vars, `AI_PROVIDER` left **unset** (P8-14), Google OAuth redirect for `*.pages.dev` | Cloudflare |
| i | `seed-cleanup --live` dry run → owner confirms → `--apply` | owner OK |
| j | Production checks in DEPLOY.md §8 (real Google + email sign-in, QR on a phone, offline navigation, push on Android + installed iPhone PWA, headers, Lighthouse) | phone |
| k | Tag `phase-10` + `v1.0.0-mvp` only after j passes | none |

### 1.4 Content pipeline that matches reality `[ASK]`
- **Problem:** the app expects a verifier **on site** (`/admin/field`: GPS auto-fill, `capture` photo, crowd per weekday, "Last verified" date, monthly re-check). The team actually researches places online and drops submissions into Google Drive folders. There is **no import tool** (`pipelines/` has no content importer). That leaves typing 100–200 places by hand into a mobile field form.
- **Proposal (needs your OK):**
  1. Add a **desk-entry mode** to `/admin/field`: lat/lng typed or picked on the map, no GPS requirement, and photo upload from file instead of camera.
  2. Add a **CSV/Sheet importer** (`pipelines/content-import`): a fixed column template (one row per place: names EN/MR, category, taluka, lat/lng, fee, hours, best time, how to reach, nearest station/bus, monsoon, tide flag, hidden gem, story/history/significance/dos/donts EN, source URLs). It writes `content_drafts` rows (`status=draft`), so reviewers still approve in `/admin/review` and nothing goes live unreviewed. Dry run by default, `--live` to write, idempotent by slug.
  3. Add **provenance columns** (new migration): `places.verification_method` enum (`desk`, `field`), `places.source_urls text[]`.
- **Why it matters:** this is the only realistic way to reach 100–200 places, and the Discover/Place UI looks empty without content (see Report 2).

### 1.5 Honest "Verified" label `[ASK]`
- **Problem:** the honest-UI rule (FRONTEND §13) puts a "Last verified" date on every page, and the brand promise is "visited and photographed by our own field team". Desk-researched rows would show "Verified 3 Oct 2026" as if someone had been there. That makes the trust signal false.
- **Proposal:** show "Checked online · 3 Oct 2026" for `desk` rows and "Visited · 3 Oct 2026" for `field` rows. Only `field` rows get the verified tick. This needs 1.4 item 3.

### 1.6 Photo rights `[ASK]`
- **Problem:** the hard rule is "No stock photos, verifier-shot only" (CLAUDE.md §2). The team plan is "one photo per place" taken from the internet. Publishing photos copied from the web is both a copyright risk and a breach of that hard rule. The `photos` table has no `credit`, `source_url` or `licence` columns.
- **Options:** (a) keep the rule and publish only own photos, with the no-photo state (made beautiful, see Report 2) for everything else; (b) allow **openly licensed** photos (CC BY / CC BY-SA from Wikimedia Commons) with mandatory `credit`, `licence` and `source_url` columns shown under the image; (c) ask owners and local photographers for permission and record it.
- **Recommended:** (a) + (b). Never publish unlicensed web images.

### 1.7 Team and legal reviews that gate launch
| Item | Where | State |
|---|---|---|
| HI/MR UI strings: 748 keys, all drafted by Claude | `apps/web/messages/*.json`, `NEEDS_REVIEW.md` | unreviewed |
| Emergency keyword list EN/HI/MR + romanised | P8-3 config | unreviewed |
| Privacy policy (full DPDPA draft, AI section) | `/privacy` | DRAFT, legal review |
| Hindi/Marathi taluka names | P1-16 | unreviewed |
| Ghat zone boxes (Kashedi, Kumbharli, Amba, Anuskura) | `pipelines/road-flags/ghat-zones.geojson` | approximate |
| TideCheck free tier allows commercial use | P3-1 | email pending |
| Ola caching confirmation | support@olakrutrim.com | email pending |
| OSM trail difficulty | P9 | team check |

---

## 2. Spec features not built, or only partly built

| # | Feature | Spec ref | What exists | Gap | Priority |
|---|---|---|---|---|---|
| 2.1 | **Saved places (heart)** | FRONTEND §6.3 (heart on every card), §7.14 (Me → saved places) | `ListingCard` has an `onsave` prop. Only `/dev/components` uses it. | No table, API, RLS or Me section. The heart never shows in the real app. BACKEND schema is silent → `[ASK]` (suggested: `saved_items(user_id, entity_type, entity_id, created_at)`, own-row RLS, optimistic toggle, guest → sign-in with `?next`). | P1 |
| 2.2 | **Active alerts on the QR scan page** | P6-12 ("add to the safety block in P9") | Alerts exist on the map (P9) | `lib/server/qr.ts` safety block has monsoon + tide only, no alerts. Add active `alerts` within ~2 km of the QR listing, with severity dot, reported time and expiry, keeping the page under the 40 KB HTML budget. | P1 |
| 2.3 | QR page GPS error uses native `alert()` | FRONTEND §12 copy rules, honest UI | `lib/qr/page.ts` inline script | A browser modal on a 2G phone is a poor experience and blocks the page. Replace it with inline status text (`aria-live="polite"`). | P1 |
| 2.4 | **Loading skeletons** | FRONTEND §6.12 | `Skeleton.svelte` exists | Used only in `/dev/components`. No route shows skeletons. Add them to client-fetched areas: similar/less-crowded, nearby, map sheet, plan routes, Crabby replies, offline packs. | P2 |
| 2.5 | Agoda live prices | P4-6, BACKEND §13 | Adapter behind `AGODA_ENABLED` returns `null` (P4-7) | Needs partner docs and keys. At launch, price comparison = owner range + admin-entered affiliate links only. Affiliate account owner (PAN/bank) is still pending. | P2 (external) |
| 2.6 | Audio guide content | P6-8 | Native `<audio>` player + upload path | No audio files. TTS waits on the Sarvam result. Students/locals recording is the USP path. | P2 (content) |
| 2.7 | Ready-made itineraries | P7-7 | Admin can flag a planned trip as ready-made | **0 rows.** Discover and `/start` hide the section. The team needs to plan ~5 (USP lists "Ratnagiri in 2 days", "Temples of Konkan", "Hidden beaches of Dapoli"; "Mumbai to Malvan" is outside MVP scope). | P1 (content) |
| 2.8 | Fuel price, default mileage, visit minutes | P7-6, P7-2 | `/admin/planner` | Not set. Without them the budget card asks the user for a fuel price. | P1 (content) |
| 2.9 | Laptop two-column layout on inner pages | P10a deferred | Place page only | Stays/Food detail, dish, itinerary, plan are single column on laptop. This will be resolved by the redesign (Report 2). | P2 |
| 2.10 | Crabby success pose ("claw wave") | FRONTEND §12 | Walking loader only | Do it with the new mascot placeholder (Report 2). | P3 |
| 2.11 | Logo, Crabby art, custom category icons | P2-13, `[OPEN]` | Placeholders (蟹 glyph, aizome dot-face, Lucide) | The 蟹 (Japanese/Chinese "crab") mark doesn't belong to a Konkan brand. Replace it with a neutral wordmark placeholder until the artist delivers (Report 2). | P2 |
| 2.12 | Weather forecast in the planner | P7-12 | Current weather only, trips starting today | OWM 2.5 free has a 5-day/3-h forecast endpoint (`/forecast`), card-free. Using it is a spec extension → `[ASK]`. | P3 |
| 2.13 | "Crabby's choice" tag for stays | your data-collection plan | none | Not in any spec → `[ASK]`. If it's editorial, it must stay separate from rating and ranking (hard rule: sponsorship never touches ranking; an editorial pick should follow the same rule and be labelled). | P3 |
| 2.14 | Influencer/reel reviews, "TBD rating", on-platform pay at stays | USP doc | — | Skipped or parked by the locked plan. The USP's "QR at stays: **pay**" conflicts with the no-payments hard rule. Keep it out. | — |

---

## 3. Fixes and hardening

| # | Issue | Evidence | Fix | Priority |
|---|---|---|---|---|
| 3.1 | **Default `EXECUTE` to PUBLIC on SECURITY DEFINER functions.** P9/P10 revoked it on 7 named functions, but any new function still gets PUBLIC execute by default. | DECISIONS "Found issues", `20261024100000_p10_hardening.sql` | One pgTAP test that lists **every** `security definer` function in `public` and asserts anon/public EXECUTE matches an explicit allowlist built from the existing `grant execute … to anon` lines (e.g. `get_shared_trip`, `trip_vote_counts`, `cast_group_vote`; confirm each from the migrations). Also `alter default privileges in schema public revoke execute on functions from public;` in a new migration. | P1 |
| 3.2 | e2e flake: `shell.test.ts` "works offline after first visit" | DECISIONS Found issues | Wait for `navigator.serviceWorker.ready` plus a controlled page before going offline; retry 1 in CI only. | P2 |
| 3.3 | Stale `wrangler pages dev` on :4173 makes local e2e test an old build | DECISIONS Found issues | A `pree2e` script that frees :4173 (PowerShell-safe: `Get-NetTCPConnection -LocalPort 4173`), or set `reuseExistingServer: false` locally. | P2 |
| 3.4 | `/map` Lighthouse mobile 31 | AUDIT.md | MapLibre shader compile is the cost. Measure on a real mid-range Android first. Cheap wins: create overlay layers (heatmap, trails, alerts, utilities) only when toggled; `fadeDuration: 0`; render the list/sheet before map init; preconnect the tiles host. Don't drop the map. | P2 |
| 3.5 | Text-field focus has no visible indicator (R-8 removed the outline) | `app.css` base | WCAG 2.4.7 needs a visible focus indicator, and a caret alone is weak. Keep "no outline box" per your call, but change the **border colour/weight on focus** (Report 2 input spec). | P1 (a11y) |
| 3.6 | Secondary text at 11–13 px | 34 uses of `text-[11–13px]` in `.svelte` files | FRONTEND §2.3: small = 14 px, tiny 12 px only for badges/chips. Move metadata lines to 14 px (part of the redesign). | P2 |
| 3.7 | Arbitrary pixel values everywhere (`text-[13px]`, `min-h-[76px]`, `w-[210px]`) | grep | Use type utilities and spacing tokens only; lint against `\[\d+px\]` in class strings, except an allowlist. | P2 |
| 3.8 | `manifest.webmanifest` theme/background `#F4F0E8` are hard-coded | `static/manifest.webmanifest` | Update with the new palette, and add `<meta name="theme-color">` per scheme (light/dark media). | P2 |
| 3.9 | Place page has no primary action | `routes/place/[slug]/+page.svelte` | No Add to trip, Directions, Save or Share on the page itself (Add to trip lives only in Crabby chips). Proposed sticky action bar: **Directions** (`/navigate?to=`), **Add to trip** (existing trip edit), **Save** (2.1), **Share** (Web Share). This is a UX addition beyond the locked order → `[ASK]`, but it doesn't reorder §7.2. | P1 |
| 3.10 | Native `history.back()` fallback goes to `/` | `TopBar.svelte` | On deep links (shared place URL, `history.length === 1`) back goes Home. That's acceptable, but listing pages should go back to their list (`/stays`, `/food`, `/taste-konkan`). | P3 |
| 3.11 | Categories as `?category=` on `/` | Discover | Fine for MVP. Give each category its own canonical + meta (no duplicate-content warning) and a real `<h1>`. | P3 |

---

## 4. Product and UX improvements (within the spec)

1. **First-run empty states.** With little content, Discover shows mostly section headings and empty states. Make every empty section either hide cleanly or show one helpful action (e.g. "Plan a trip", "Open the map"). Never show more than one "coming soon" block per screen.
2. **Search.** One search covers places, stays, food and dishes (`/api/map/search`). Group results by type with counts, show recent searches (local, try/catch), and fall back to Ola only when signed in (as now).
3. **Place → map hand-off.** "See on map" should open `/map` focused on the pin with the sheet at half height.
4. **Plan view.** Show the day's route as a mini map strip above the timeline (stored OSRM shapes, already fetched for navigation), then times and reason chips. Keep the drag and Move up/down buttons.
5. **Live trip.** Make the current stop the hero card, with a big "Navigate" button and the nudge banner above it. Under bright sunlight use the high-contrast dark scheme (the spec already auto-suggests dark after sunset).
6. **Group vote.** Show live counts per spot as you vote, plus a clear "Done, send to organiser" end state.
7. **Me.** Order: trips → saved → offline packs → preferences → privacy/consents → language/theme → sign out.
8. **Staff tools.** Add a counter header in `/admin` ("12 drafts, 3 reports, 2 claims waiting") so reviewers see the queue.
9. **Analytics (₹0, privacy-safe).** There is no analytics at all. Cloudflare Web Analytics is free, cookieless and needs no card. It's a new third-party script → CSP change → `[ASK]`.

---

## 5. Docs and repo hygiene

- `CRABWALK_FRONTEND.md` §2/§5/§8 are outdated by P10a (and will be again by the redesign). Spec files are not to be edited (CLAUDE.md §5). Add one line at the top of DECISIONS stating that **visual tokens live in `apps/web/src/app.css` and the design doc in `docs/design/`**, and that FRONTEND §2/§8 values are historical.
- `AUDIT.md` sits at the repo root while the rest of the docs live in `docs/`. Move it to `docs/AUDIT.md` (with your OK).
- `apps/web/.wrangler/tmp` holds 100+ stale bundle dirs. It's git-ignored (good), so just clear it occasionally to save disk space.
- `README.md` should state the live URL and the deploy status after 1.3.

---

## 6. Suggested order of work

1. **Now:** 1.1 land refinement → 1.2 devAuth guard → 3.1 definer-grant test.
2. **Decisions batch (ask once):** 1.4, 1.5, 1.6, 2.1, 2.13, 3.9, 4.9, plus the redesign direction (Report 2).
3. **Redesign** (Report 2) together with 2.2, 2.3, 2.4, 3.5, 3.6, 3.7, 3.8, 3.9 (they touch the same files).
4. **Content tooling:** 1.4 importer + desk mode → team loads 100–200 places → ~5 itineraries → planner config (2.7, 2.8).
5. **Guided deploy** 1.3 → production checks → tags.
6. **After launch:** 2.5 Agoda, 2.6 audio, 2.12 forecast, analytics, Konkan-wide (Sindhudurg) as data rows only.
