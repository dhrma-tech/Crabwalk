# Crabwalk — production refinement audit

Branch `refinement` (from `main` @ `2ff0826`, after phase-10a). Product, scope and hard rules: `CLAUDE.md`,
`CRABWALK_PLAN.md`, `docs/DECISIONS.md`. This file tracks the refinement pass: what was found, what was done,
and what was deliberately left alone.

**How it was audited:** full read of structure / routes (57 API endpoints, 35 page loaders) / server libs /
schema; `lint`, `typecheck`, unit, DB and e2e suites; a scripted walk of 23 public + 18 signed-in routes
(verifier + reviewer user) at 360 / 768 / 1024 / 1440 px capturing console errors, failed requests,
horizontal scroll, touch targets, alt text and headings; junk-input probes against every endpoint; FK-index
and dead-code scans; Lighthouse 13 (mobile + desktop) on four key pages.

**Baseline:** lint ✓, typecheck ✓ (0 errors), 145 unit ✓, 227 DB ✓, 61 e2e ✓, build ✓. No `any`, no
`{@html}`, no TODOs, no unused runtime dependencies; `console.log` only in pipeline CLIs (intended).

## Lighthouse

Local production-like build (`vite build --mode audit` + `wrangler pages dev`), Lighthouse 13.5, simulated
throttling. Perf / Accessibility / Best practices / SEO.

| Page | Before (mobile) | Before (desktop) | After (mobile) | After (desktop) |
|---|---|---|---|---|
| `/` | 99 / 100 / 100 / 91 | 100 / 100 / 100 / 91 | 96 / 100 / 100 / 100 | 99 / 100 / 100 / 100 |
| `/place/:slug` | 97 / 100 / 100 / 91 | 100 / 100 / 100 / 91 | 93 / 100 / 100 / 100 | 99 / 100 / 100 / 100 |
| `/map` | 61* / 100 / 96 / 91 | 96* / 100 / 96 / 91 | 31 / 100 / 100 / 100 | 61 / 100 / 100 / 100 |
| `/stays` | 97 / 98 / 100 / 91 | 100 / 98 / 100 / 91 | 96 / 100 / 100 / 100 | 100 / 100 / 100 / 100 |

\* The "before" map was broken under Lighthouse: the pin-glyph `EncodingError` aborted every overlay, so no
pins, clusters or heatmap were built and their WebGL shaders never compiled. "After" measures a working map.
The remaining cost is MapLibre's shader compilation (one constructor ≈ 480 ms unthrottled), which headless
Lighthouse runs in software (SwiftShader); real phones compile on the GPU. Every other page scores 93–100 in
all four categories. Small TBT drift on other pages (20 → 140–210 ms mobile) is within run-to-run variance on
this laptop.

## Findings

### Critical
- [x] **Map pins can vanish.** Pin glyphs load with `img.decode()`, which Chromium can reject for SVG data
  URLs under load (`EncodingError` seen in Lighthouse); one rejection aborts *all* overlays (pins, alerts,
  tides, route). → load event + per-glyph isolation.
- [x] **500s on malformed input.** `GET /api/places?category=bogus`; non-form bodies to `/prefs`,
  `/q/:code/report`, and (signed in) `/api/reviews`, `/api/booking-proofs`, `/api/admin/photos`.

### High
- [x] **403 shows the wrong state:** "This page didn't load / Try again" instead of a not-allowed state.
- [x] **Sign-in dead end:** protected pages redirect to `/login` with no return path; after signing in the
  user is left on `/login`.
- [x] **Forms have no pending state** in 23 of 28 forms (double submit possible, no busy feedback).
- [x] **SEO:** no meta descriptions, Open Graph / Twitter tags or canonical links; no `sitemap.xml`;
  `robots.txt` doesn't keep crawlers out of admin / owner / API / private-token pages; 403/404/500 titles are
  just "Crabwalk".
- [x] **Touch targets < 44 px** on every page: language switch (36 px wide), search field (43 px tall),
  "See all" / wordmark / Crabby privacy links (18–27 px), list rows on Nearby and admin lists (24–42 px).
- [x] **DB:** foreign keys used by queries and RLS without an index (`trips.owner_id`,
  `stays/eateries.owner_id`, `push_subscriptions/ai_actions/owner_claims/booking_proofs/review_photos.user_id`,
  `crowd_typical/place_seasonal/dwell_events/verifier_notes.place_id`, `stay_offers.stay_id`,
  `eatery_dishes.dish_id`, `travel_matrix.to_point_id`, `utility_pois.taluka_id`, `reports.qr_code`).
- [x] **`.env.example` incomplete:** `OLA_PROXY_URL`, `CRON_SECRET`, `PIPELINE_DB_URL`, `E2E_SUPABASE` missing.

### Medium
- [x] **`/map` loading:** no loading state while the map library downloads and starts; mobile LCP 4.4 s is
  MapLibre's attribution text appearing late.
- [x] **List filters unvalidated:** `/api/stays`, `/api/eateries`, `/api/places` ignore or crash on invalid
  values instead of answering 400.
- [x] `/admin/field` scrolls sideways at 360 px (366 px content).
- [x] Heading order skips h2 on `/stays` and `/food` (h1 → card h3); signed-in `/plan/new` has two h1s.
- [x] No hover / active feedback on buttons, chips, cards, tabs and nav links (focus rings only).
- [x] No `handleError` hook: unexpected server errors carry no id to match a user report to the server log.
- [x] `/favicon.ico` 404s (crawlers and some browsers ask for it regardless of `<link rel=icon>`).
- [x] z-index values are ad hoc (10 / 20 / 30 / 40 / 50) instead of named layers.

### Low
- [x] `README.md` is two lines; `apps/web/README.md` is the `sv` starter boilerplate.
- [x] `/api/recommend/{similar,less-crowded}/:place` answer `200 []` for unknown places — **kept**: an empty
  list is a valid "no recommendations" answer; telling unknown from empty costs an extra query per call.
- [x] Map attribution links are 17 px tall (MapLibre control) — **kept**: legal attribution text inside the
  library control; padding it to 44 px would cover the map corner.

### Accepted as is (with reason)
- The 404 page logs "Failed to load resource: 404" in the console — that is the browser reporting the
  correct 404 status, not an app error.
- "Geolocation support is not available" warning on `/navigate` appears only in headless test browsers.
- `/map` Total Blocking Time is MapLibre GL's own startup (WebGL vector map, already lazy-loaded and
  code-split); reducing it further would mean not showing the map on the map page.
- `[OPEN]` product items stay open (custom category icons, Crabby art, Tiro story font) — CLAUDE.md §1.

### Found while fixing
- [x] The sign-in code field's `pattern="[0-9]{6}"` was rendered by Svelte as `[0-9]6` (braces are
  expressions), so the browser rejected every code. Fixed with `pattern={'[0-9]{6}'}`; caught by the route
  sweep.

## What changed (by commit)
- `fix(map)` pin glyphs load on the load event, one failure no longer kills all overlays.
- `fix(api)` Zod list filters (`lib/server/filters.ts`, tested); `formBody()` → 400 for malformed bodies;
  one vocabulary module (`lib/vocab.ts`).
- `feat(auth)` validated `next` return path (`lib/login.ts`, tested), Zod-checked email/code, OAuth via cookie.
- `feat(errors)` not-allowed state for 401/403, `handleError` reference ids for unexpected errors.
- `perf(db)` 17 FK indexes + pgTAP guard (`supabase/tests/refinement_indexes.test.sql`).
- `feat(forms)` `use:submitting` + plain-form guard (`lib/forms.ts`).
- `feat(seo)` `Meta` component, sitemap.xml, robots.txt, X-Robots-Tag, favicon.ico.
- `feat(ui)` hover/active states, 44 px targets, named z-layers, map loading note, one input style.
- `docs` README, `.env.example`.

**Verification at the end:** lint ✓, typecheck ✓, 155 unit ✓ (web 138, pipelines 11, ola-proxy 6), 245 DB ✓, 61 e2e ✓, build ✓;
0 × 5xx across 110 junk-input requests; route sweep clean apart from the accepted items above.

## Decisions (refinement)
- Work stays on `refinement`; `main` untouched. Conventional commits per unit of work.
- Filters: API strict (400), pages lenient (bad values dropped) — a shared link must never 500 a page.
- OAuth return path in a 10-minute httpOnly cookie, not the redirect URL (Supabase allow-list is exact).
- Plain-form guard disables buttons *after* the request body is built (the submitter's value must survive).
- New HI/MR copy (meta descriptions, not-allowed text, error reference) drafted by Claude — team review.
- No license added: choosing one is the owner's call.
- Hard rules unchanged (₹0, AI firewall, no Ola tiles, no fake live data, no stock photos, no secrets).
