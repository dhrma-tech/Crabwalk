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
| `/` | 99 / 100 / 100 / 91 | 100 / 100 / 100 / 91 | | |
| `/place/:slug` | 97 / 100 / 100 / 91 | 100 / 100 / 100 / 91 | | |
| `/map` | 61 / 100 / 96 / 91 | 96 / 100 / 96 / 91 | | |
| `/stays` | 97 / 98 / 100 / 91 | 100 / 98 / 100 / 91 | | |

## Findings

### Critical
- [ ] **Map pins can vanish.** Pin glyphs load with `img.decode()`, which Chromium can reject for SVG data
  URLs under load (`EncodingError` seen in Lighthouse); one rejection aborts *all* overlays (pins, alerts,
  tides, route). → load event + per-glyph isolation.
- [ ] **500s on malformed input.** `GET /api/places?category=bogus`; non-form bodies to `/prefs`,
  `/q/:code/report`, and (signed in) `/api/reviews`, `/api/booking-proofs`, `/api/admin/photos`.

### High
- [ ] **403 shows the wrong state:** "This page didn't load / Try again" instead of a not-allowed state.
- [ ] **Sign-in dead end:** protected pages redirect to `/login` with no return path; after signing in the
  user is left on `/login`.
- [ ] **Forms have no pending state** in 23 of 28 forms (double submit possible, no busy feedback).
- [ ] **SEO:** no meta descriptions, Open Graph / Twitter tags or canonical links; no `sitemap.xml`;
  `robots.txt` doesn't keep crawlers out of admin / owner / API / private-token pages; 403/404/500 titles are
  just "Crabwalk".
- [ ] **Touch targets < 44 px** on every page: language switch (36 px wide), search field (43 px tall),
  "See all" / wordmark / Crabby privacy links (18–27 px), list rows on Nearby and admin lists (24–42 px).
- [ ] **DB:** foreign keys used by queries and RLS without an index (`trips.owner_id`,
  `stays/eateries.owner_id`, `push_subscriptions/ai_actions/owner_claims/booking_proofs/review_photos.user_id`,
  `crowd_typical/place_seasonal/dwell_events/verifier_notes.place_id`, `stay_offers.stay_id`,
  `eatery_dishes.dish_id`, `travel_matrix.to_point_id`, `utility_pois.taluka_id`, `reports.qr_code`).
- [ ] **`.env.example` incomplete:** `OLA_PROXY_URL`, `CRON_SECRET`, `PIPELINE_DB_URL`, `E2E_SUPABASE` missing.

### Medium
- [ ] **`/map` loading:** no loading state while the map library downloads and starts; mobile LCP 4.4 s is
  MapLibre's attribution text appearing late.
- [ ] **List filters unvalidated:** `/api/stays`, `/api/eateries`, `/api/places` ignore or crash on invalid
  values instead of answering 400.
- [ ] `/admin/field` scrolls sideways at 360 px (366 px content).
- [ ] Heading order skips h2 on `/stays` and `/food` (h1 → card h3); signed-in `/plan/new` has two h1s.
- [ ] No hover / active feedback on buttons, chips, cards, tabs and nav links (focus rings only).
- [ ] No `handleError` hook: unexpected server errors carry no id to match a user report to the server log.
- [ ] `/favicon.ico` 404s (crawlers and some browsers ask for it regardless of `<link rel=icon>`).
- [ ] z-index values are ad hoc (10 / 20 / 30 / 40 / 50) instead of named layers.

### Low
- [ ] `README.md` is two lines; `apps/web/README.md` is the `sv` starter boilerplate.
- [ ] `/api/recommend/{similar,less-crowded}/:place` answer `200 []` for unknown places (404 is accurate).
- [ ] Map attribution links are 17 px tall (MapLibre control).

### Accepted as is (with reason)
- The 404 page logs "Failed to load resource: 404" in the console — that is the browser reporting the
  correct 404 status, not an app error.
- "Geolocation support is not available" warning on `/navigate` appears only in headless test browsers.
- `/map` Total Blocking Time is MapLibre GL's own startup (WebGL vector map, already lazy-loaded and
  code-split); reducing it further would mean not showing the map on the map page.
- `[OPEN]` product items stay open (custom category icons, Crabby art, Tiro story font) — CLAUDE.md §1.

## Decisions (refinement)
- Work stays on `refinement`; `main` untouched. Conventional commits per unit of work.
- Hard rules unchanged (₹0, AI firewall, no Ola tiles, no fake live data, no stock photos, no secrets).
