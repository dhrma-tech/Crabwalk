# CRABWALK — MASTER BUILD PLAN (Prompt for Claude Code)

> **Read this file first.** It is the execution order. Companion files:
> - `CRABWALK_BACKEND.md` — database, services, pipelines, AI, integrations
> - `CRABWALK_FRONTEND.md` — PWA, screens, components, design system
> - Source of truth (locked decisions): `Crabwalk Plan.md`, `Crabwalk Design.md`
>
> Generated: 17 Oct 2026. Target: MVP live by **9 Nov 2026** (4 weeks from project start on 12 Oct 2026).

---

## 0. ROLE AND OPERATING RULES (apply to every phase)

You are the sole engineer building **Crabwalk**, a tourism PWA for **Ratnagiri** (Konkan, Maharashtra). Follow these rules without exception:

1. **No invention.** Implement only what is written in this file, `CRABWALK_BACKEND.md`, `CRABWALK_FRONTEND.md`. Anything marked `[OPEN]` is NOT decided — stop and ask the user before implementing it. Anything marked `[DEFAULT]` is an implementation default not in the locked plan — use it unless the user overrides it in Phase 0.
2. **Budget is ₹0.** Use only free tiers. Never add a paid service, card-required service, or paid API. If a task seems to need one, stop and ask.
3. **One phase at a time.** Phases are strictly sequential. Never start Phase N+1 until Phase N is pushed to `main` and its acceptance checklist passes. If a phase slips, every later phase shifts by the same number of days — phases never overlap.
4. **Git rule.** At the end of every phase: run checks → commit → push to `main` → tag `phase-N`. Exact commands in §3.
5. **Single MVP.** No v1/v2 split. Every feature in the plan ships in this MVP.
6. **Scope:** Ratnagiri only. Platform: PWA (installable, offline-capable).
7. **Hard prohibitions** (from locked plan):
   - Never send Ola Maps data to any AI/LLM code path (AI firewall).
   - Never use Ola map tiles. Map display is OSM only.
   - Never cache Ola results on a shared server cache (user device PWA cache only).
   - Never scrape OTAs (MakeMyTrip, Booking.com, Agoda, etc.).
   - Never take payments on the platform.
   - Never let sponsorship affect ratings, ranking, or AI recommendations.
   - Never show fake "live" data — label "Live" vs "Typical".
   - Never use stock photos — verifier-shot photos only.
   - Never send phone numbers or live location history to free-tier LLMs.
   - Never let the LLM invent facts, places, or routes.
   - Never copy from Ola or Google Maps when editing OSM.
8. **Secrets** live only in environment variables. Commit a `.env.example` with variable names, never values.
9. **Keep `docs/DECISIONS.md` updated** — every `[OPEN]` resolved by the user gets logged there with date.
10. **Language of UI:** English, Hindi, Marathi — all three, from Phase 2 onward.

---

## 1. LOCKED PRODUCT SUMMARY (do not change)

| Area | Locked decision |
|---|---|
| City | Ratnagiri only |
| Platform | PWA, installable, offline-capable |
| Budget | ₹0 |
| Booking | Redirect + price comparison; no payments |
| Food apps | Swiggy, Zomato + others (EatSure, Magicpin, etc.) — verifier marks availability + deep link (no public listing API) |
| Rating | Verdict gauge (4 verdicts, winning % + total votes), per group type (family/couple/solo/friends), sub-scores, "New" until 10 votes |
| Map display | MapLibre GL JS + self-hosted Ratnagiri OSM PMTiles (Protomaps) |
| Travel times | Own OSRM matrix (~300 points ≈ 90K pairs) + ghat/coastal/monsoon correction factors, stored in Supabase |
| Ola Maps | Directions + Autocomplete for places NOT in our DB only; display only; separate service + separate key |
| Fallback | "Open in Google Maps" button for long highway drives |
| AI | Assistant "Crabby"; EN/HI/MR; login required; ~20 msgs/user/day; acts via previews + confirm |
| LLMs | Groq Llama 8B (intent/moderation/quick), Gemini Flash/Flash-Lite (explanations/Q&A), fallback Groq 70B → Gemini Flash-Lite; skip OpenRouter |
| Embeddings | Open-source multilingual model, run once on laptop → Supabase pgvector |
| Weather | OpenWeatherMap free tier, ~20 Ratnagiri points hourly, cached in DB |
| Tides | TidesAtlas (CC BY 4.0) daily per coastal station; backup TideCheck |
| QR | Permanent short URL `/q/RTN-001`; no app/login; <100 KB page |
| Prices | Agoda Partners API (live) + affiliate deep links (INRDeals/Cuelinks) + owner price range for homestays |
| Design | "Laterite and sea"; Baloo 2 + Mukta; tokens in `CRABWALK_FRONTEND.md` §2 |

---

## 2. PROPOSED REPOSITORY LAYOUT `[DEFAULT]`

```
crabwalk/
├── apps/
│   ├── web/                # PWA (framework chosen in Phase 0)
│   └── qr/                 # standalone QR scan page (no framework, <100 KB)
├── services/
│   ├── api/                # server functions: AI router, planner, crons
│   └── ola-proxy/          # isolated Ola service (separate key, no AI access)
├── supabase/
│   ├── migrations/         # SQL migrations
│   └── seed/               # dev-only seed (flagged, never published)
├── pipelines/              # laptop scripts: OSM extract, OSRM matrix, PMTiles, embeddings, POI import
├── docs/
│   ├── DECISIONS.md
│   ├── Crabwalk Plan.md    # copy of locked plan
│   └── Crabwalk Design.md  # copy of locked design
├── CRABWALK_PLAN.md
├── CRABWALK_BACKEND.md
├── CRABWALK_FRONTEND.md
└── .env.example
```

---

## 3. GIT PROTOCOL (run at end of EVERY phase)

```bash
# 1. Checks — all must pass
<pkg-manager> run lint
<pkg-manager> run typecheck
<pkg-manager> run test
<pkg-manager> run build

# 2. Verify nothing secret is staged
git status
git diff --cached --name-only | grep -Ei '\.env$|secret|key' && echo "STOP: secret staged" || true

# 3. Commit and push
git add -A
git commit -m "feat(phase-N): <phase name> — <one-line summary>"
git pull --rebase origin main      # resolve conflicts before pushing; never force-push
git push origin main
git tag phase-N && git push origin phase-N
```

- Never `git push --force` to `main`.
- If a check fails, fix it inside the same phase — do not push broken code.
- After push, update `docs/DECISIONS.md` "Phase log" with: phase, date pushed, commit hash, anything deferred.

---

## 4. PHASE TIMELINE (sequential, no overlap)

| Phase | Name | Dates (2026) | Days |
|---|---|---|---|
| P0 | Foundation + decision gate | 17 Oct – 18 Oct | 2 |
| P1 | Database, auth, security | 19 Oct – 20 Oct | 2 |
| P2 | App shell, design system, i18n | 21 Oct – 22 Oct | 2 |
| P3 | Geo + context pipelines, Map | 23 Oct – 25 Oct | 3 |
| P4 | Content: places, stays, food, dishes, admin, owner claim | 26 Oct – 28 Oct | 3 |
| P5 | Ratings and reviews | 29 Oct – 30 Oct | 2 |
| P6 | QR system | 31 Oct – 1 Nov | 2 |
| P7 | Trip planner | 2 Nov – 4 Nov | 3 |
| P8 | Crabby AI | 5 Nov – 6 Nov | 2 |
| P9 | Live trip, navigation, offline, push, pattern analysis | 7 Nov – 8 Nov | 2 |
| P10 | Hardening + launch | 9 Nov | 1 |

**Parallel non-code track (team, not you):** field verification by verifiers (1 per taluka, ~10–15 visits each) starts once the admin form ships in P4. It uses the app; it does not create a code phase and does not conflict with this timeline.

**If the 4-week target is not required, keep the order and the no-overlap rule; only the dates stretch.**

---

## P0 — FOUNDATION + DECISION GATE (17–18 Oct)

**Goal:** repo exists, open decisions are resolved, tooling works.

### Step 1 — Ask the user these questions BEFORE writing app code
Ask all at once. Log answers in `docs/DECISIONS.md`.

| # | Question | Status in locked plan |
|---|---|---|
| G1 | Frontend framework: SvelteKit or Next.js? | `[OPEN]` (Design §15) |
| G2 | Server runtime for API/crons: Supabase Edge Functions + pg_cron, or Vercel functions + Vercel cron? | `[OPEN]` |
| G3 | Hosting for PWA + PMTiles: Vercel or Cloudflare? | `[OPEN]` (plan says "Vercel/Cloudflare") |
| G4 | User login method (email magic link / Google / phone OTP)? Note: SMS OTP usually costs money | `[OPEN]` |
| G5 | Owner claim OTP channel (plan says "OTP"; SMS vs email/WhatsApp)? | `[OPEN]` |
| G6 | Booking-proof method for verified hygiene/cleanliness votes (how is proof submitted and checked)? | `[OPEN]` |
| G7 | Multilingual embedding model name | `[OPEN]` |
| G8 | Correction factor values (ghat, coastal, monsoon) | `[OPEN]` — build as editable config table |
| G9 | Alert auto-expiry duration (design copy example implies ~24 h) | `[OPEN]` |
| G10 | Live crowd override threshold (how many scans/check-ins = "Live") | `[OPEN]` |
| G11 | Tiro Devanagari Marathi for stories, or Mukta only | `[OPEN]` (Design §15) |
| G12 | Package manager / monorepo tool | `[DEFAULT]` pnpm workspaces |

Known pending (not blocking code, track in DECISIONS.md): Sarvam AI result (Suhani), Ola caching email to support@olakrutrim.com, plaque permissions, affiliate account owner (PAN/bank), logo + Crabby mascot artist, custom category icon set, exact place count (100–200), TBD rating (parked — do not build).

### Step 2 — Tasks
1. `git init`, create GitHub repo (user provides remote), default branch `main`.
2. Create layout from §2. Copy locked docs into `docs/`.
3. Scaffold `apps/web` with the framework from G1, TypeScript strict.
4. Scaffold `apps/qr` as plain HTML/CSS + minimal vanilla JS (no framework).
5. Add ESLint, Prettier, typecheck, test runner, build scripts at root.
6. Create Supabase project (free tier) — user does signup; you wire env vars.
7. Write `.env.example` (see `CRABWALK_BACKEND.md` §12).
8. Add `.gitignore` (env files, PMTiles builds, OSRM data, node_modules).
9. Add GitHub Actions CI: lint + typecheck + test + build on push to `main` `[DEFAULT]`.
10. Write `docs/DECISIONS.md` with gate answers + "Phase log" table.

### Acceptance
- [ ] All G1–G12 answered or explicitly deferred by user
- [ ] `build` passes for `apps/web` and `apps/qr`
- [ ] CI green
- [ ] No secrets in repo
- [ ] **Push to `main`, tag `phase-0`**

---

## P1 — DATABASE, AUTH, SECURITY (19–20 Oct)

**Goal:** full schema + RLS + auth live in Supabase.

### Tasks
1. Write migrations for every table in `CRABWALK_BACKEND.md` §3 (all tables now, even if used later — avoids schema churn).
2. Enable extensions: `postgis` `[DEFAULT]` (distance queries), `pgvector` (locked).
3. RLS policies per `CRABWALK_BACKEND.md` §4.
4. Auth per G4. Profiles table auto-created on signup.
5. Roles: `user`, `verifier`, `reviewer` (content approver), `owner`, `admin`.
6. Generate typed DB client for `apps/web`.
7. Dev-only seed: 5 fake places, 3 stays, 3 eateries, 3 dishes — every seed row has `is_seed = true`; production queries exclude it.
8. Tests: RLS tests (anon can read published; anon cannot write; owner cannot edit ratings; non-verified user cannot vote hygiene/cleanliness).

### Acceptance
- [ ] Migrations apply clean on fresh DB
- [ ] RLS tests pass
- [ ] Sign-in works end to end
- [ ] **Push to `main`, tag `phase-1`**

---

## P2 — APP SHELL, DESIGN SYSTEM, i18n (21–22 Oct)

**Goal:** installable PWA shell with locked design tokens and 3 languages.

### Tasks (detail in `CRABWALK_FRONTEND.md` §2–§6, §10–§12)
1. Design tokens (CSS vars from Design §14) + Tailwind mapping `[DEFAULT: Tailwind, since Design §14 specifies the mapping]`.
2. Self-hosted fonts: Baloo 2 (600, 700), Mukta (400, 600), WOFF2, Latin + Devanagari subset, max 4 files.
3. Light default + dark mode (system + manual override).
4. Bottom nav (Discover · Map · Crabby · Plan · Me), top bar (back, title, EN/हि/म switch, search), desktop left rail.
5. i18n: EN/HI/MR, auto-detect from phone, one-tap switch, `:lang(mr), :lang(hi)` rules, Indian number grouping.
6. Component library: buttons, chips, cards (place/stay/eatery shells), inputs, bottom sheet, toasts, skeletons, empty/error/offline states, status badges.
7. PWA: manifest, service worker, app-shell caching.
8. Accessibility baseline: focus rings, labels, 44 px targets, reduced motion.

### Acceptance
- [ ] Lighthouse PWA installable; app shell JS < 200 KB gzipped
- [ ] Every component renders with longest Marathi string without clipping
- [ ] Dark mode tokens apply; contrast rules met
- [ ] **Push to `main`, tag `phase-2`**

---

## P3 — GEO + CONTEXT PIPELINES, MAP (23–25 Oct)

**Goal:** own map, own travel-time matrix, utility POIs, weather + tide caches, Map screen.

### Tasks (detail in `CRABWALK_BACKEND.md` §6–§8, `CRABWALK_FRONTEND.md` §8)
1. Pipeline: download Ratnagiri-region OSM extract (Geofabrik).
2. Pipeline: build Ratnagiri PMTiles (Protomaps); deploy to host from G3. Also build per-taluka packs (9 talukas).
3. Pipeline: OSRM on laptop → time + distance + route shape for all point pairs → apply correction factors (G8 config table) → upload to `travel_matrix`.
4. Pipeline: import utility POIs from OSM (fuel, ATM, hospital, pharmacy, police, toilets, EV chargers, mechanics, bus stands, railway stations, ferry jetties).
5. Cron: OpenWeatherMap hourly for ~20 Ratnagiri points → `weather_cache`.
6. Cron: TidesAtlas daily per coastal station → `tide_cache` (backup TideCheck behind a switch).
7. `ola-proxy` service: Directions + Autocomplete, separate key, AI has no access.
8. Map screen: MapLibre, map style (Design §8), pins, clusters, filters, utility layer toggles, "Open now" filter, bottom sheet, attribution.

### Acceptance
- [ ] Map renders from own PMTiles; no Ola tiles requested (check network tab)
- [ ] Matrix row count ≈ N×(N−1) for current N points; script re-runnable
- [ ] Weather + tide crons write rows; tide attribution visible
- [ ] Code search proves AI code paths cannot import `ola-proxy` or read its key
- [ ] **Push to `main`, tag `phase-3`**

---

## P4 — CONTENT: PLACES, STAYS, FOOD, DISHES, ADMIN, OWNER CLAIM (26–28 Oct)

**Goal:** all listing pages + field data entry + owner editing.

### Tasks
1. Verifier admin form (mobile): GPS auto-fill, photo capture, fixed checklist, crowd level, monsoon status → DB.
2. Content workflow: AI draft story/history + translations from verifier notes → reviewer approves → publish. (AI drafting can be stubbed until P8; workflow states must exist now.)
3. Discover home, Place page, Stays list/detail, Food list/eatery detail, Taste Konkan dish guide.
4. "Last verified" date on every page; monthly re-check queue.
5. Owner claim (OTP per G5): edit facts only (photos, prices, menu, timings, contact) — never ratings/reviews.
6. Stay price comparison: Agoda Partners API adapter + affiliate deep links + owner price range + call/WhatsApp. If Agoda key not yet issued, ship adapter disabled by env flag.
7. Food-app availability buttons (verifier-marked + deep link).
8. Report triage list for verifiers.

### Acceptance
- [ ] Verifier can create a place in the field and it appears after approval
- [ ] Owner edits never touch rating tables (RLS-tested)
- [ ] Price table shows source label per price
- [ ] **Push to `main`, tag `phase-4`**

---

## P5 — RATINGS AND REVIEWS (29–30 Oct)

**Goal:** verdict gauge system exactly as locked.

### Tasks (detail `CRABWALK_BACKEND.md` §5, `CRABWALK_FRONTEND.md` §6.4)
1. Vote API: one verdict per user per item per group type; editable.
2. Sub-score quick taps after verdict (food: taste, authenticity, hygiene, value; stays: cleanliness, value, host, location).
3. Hygiene/cleanliness only from verified visits (QR scan + GPS ≤ ~200 m, or booking proof per G6).
4. Aggregation view: winning verdict, %, total votes per group type; "New" until 10 votes.
5. Optional text + photos; moderation hook (model wired in P8; queue exists now).
6. Nightly review summary job (stub until P8).

### Acceptance
- [ ] Gauge shows correct winner/%/count per group type
- [ ] Unverified user cannot submit hygiene/cleanliness (server-enforced)
- [ ] "New" state below 10 votes
- [ ] **Push to `main`, tag `phase-5`**

---

## P6 — QR SYSTEM (31 Oct – 1 Nov)

**Goal:** scan page + short URLs + verified visit + reports.

### Tasks (detail `CRABWALK_BACKEND.md` §9, `CRABWALK_FRONTEND.md` §7)
1. Short code generator `RTN-001…`; `/q/:code` resolves to place; content editable without reprint.
2. Standalone scan page in `apps/qr`: order = name + photo → audio guide → story/history → do's & don'ts → safety/status → Near me now → emergency button pinned; sponsor line grey at bottom; language auto-detect + switch; system fonts; <100 KB; loads on 2G; opens from PWA cache if installed.
3. Verified visit endpoint: scan + GPS within ~200 m → `verified_visits`.
4. Report a problem (broken QR, garbage, unsafe spot, wrong info) → triage dashboard.
5. QR at stays & eateries: menu, reviews, leave review (no pay).
6. QR at stations & bus stands: "Start your Konkan trip" landing.
7. Plaque print sheet generator: place name, QR, 112, short URL.
8. Audio guide player slots (TTS generation depends on Sarvam result — player + upload path now).

### Acceptance
- [ ] Scan page total transfer < 100 KB, no webfonts, no framework
- [ ] Works with no login
- [ ] Emergency button calls 112 and shares location
- [ ] **Push to `main`, tag `phase-6`**

---

## P7 — TRIP PLANNER (2–4 Nov)

**Goal:** deterministic planner + ready-made itineraries + group + export.

### Tasks (detail `CRABWALK_BACKEND.md` §10, `CRABWALK_FRONTEND.md` §7 screens 8–10)
1. Inputs: days, start point, budget, group type, interests, pace, Standout toggle.
2. Deterministic planner using matrix + opening hours + tides + weather + closures + festivals calendar.
3. Standout mode: prefer hidden-gem tags + calm/empty crowd.
4. Each stop has a short reason.
5. Drag-and-drop edit; add stays and meals.
6. Budget estimator: stay + food + fuel (distance × fuel price × mileage) + entry + activities; vehicle/mileage editable.
7. ~5 ready-made itineraries (content by team).
8. Group planning: share link, friends vote without login, per-person cost (total ÷ people). AI merge in P8.
9. Share link, PDF export, Google Maps export one link per day (≤10 stops each).
10. Custom routes: users publish after team review.
11. Festivals/events calendar admin (Ganpati, Shimga, jatras, mango season, etc.).

### Acceptance
- [ ] Plan never schedules a stop outside opening hours or during tide cut-off
- [ ] Google Maps links ≤10 stops each
- [ ] Guest voter flow works without login
- [ ] **Push to `main`, tag `phase-7`**

---

## P8 — CRABBY AI (5–6 Nov)

**Goal:** assistant everywhere, tool-calling only, multi-provider router.

### Tasks (detail `CRABWALK_BACKEND.md` §11, `CRABWALK_FRONTEND.md` §6.7)
1. Router: Groq 8B intent/moderation → Gemini Flash/Flash-Lite explanations/Q&A → fallback Groq 70B → Gemini Flash-Lite.
2. Tools: search/read our DB, build/edit plan (calls P7 planner), open map/start navigation, shortlist stays + booking link, save/share.
3. Every action returns a preview; user taps Apply/Discard.
4. Memory = preferences only (veg, budget, group type, past trips).
5. Unknown → "don't know" + verified nearby alternatives.
6. Emergency keywords bypass AI client-side → emergency card.
7. Login required; ~20 msgs/user/day; voice input (Web Speech API).
8. Group vote merge + trade-off explanation.
9. Wire stubs from P4/P5: content drafting helper, moderation, nightly review summaries.
10. Embeddings (G7) → pgvector; "similar places" + "less crowded alternative" (embeddings + rules, no LLM).
11. Stay price-compare suggestions (light LLM).
12. Privacy policy text discloses AI processing.

### Acceptance
- [ ] Static check: no import path from AI code to `ola-proxy`; no Ola env var in AI service
- [ ] No phone number / location history in any LLM payload (log-inspected test)
- [ ] 21st message in a day is refused gracefully
- [ ] Provider 429 → falls through chain
- [ ] **Push to `main`, tag `phase-8`**

---

## P9 — LIVE TRIP, NAVIGATION, OFFLINE, PUSH, PATTERN ANALYSIS (7–8 Nov)

### Tasks
1. In-browser navigation: GPS dot, route line (stored OSRM shapes; Ola Directions for non-DB places), step list, voice (Web Speech API), screen wake lock. Show limits notice (GPS pauses when minimized; iOS Safari).
2. Live trip mode: rules + matrix decide nudges, LLM explains; GPS nudges while app open; time nudges via web push (iPhone needs installed PWA).
3. Offline: taluka pack download (tiles + data), saved trips' routes cached automatically, offline banner.
4. Live & safety map layers: "Busy now" heatmap (Live vs Typical label), road/ghat/landslide alerts with auto-expiry (G9), tide layer with badges + time slider, trails with GPX.
5. Pattern analysis: better stop order; opt-in anonymous GPS dwell time (DPDPA consent, anonymized); trending/underrated routes from saved & completed trips.
6. "Open in Google Maps" fallback button for long highway drives.

### Acceptance
- [ ] Planned route navigates fully offline after pack download
- [ ] Dwell time collected only with explicit opt-in, revocable in Me
- [ ] Heatmap labels data source every time
- [ ] **Push to `main`, tag `phase-9`**

---

## P10 — HARDENING + LAUNCH (9 Nov)

### Tasks
1. Security: RLS audit, rate limits, input validation, CSP headers, secrets audit.
2. Performance budgets (`CRABWALK_FRONTEND.md` §11): LCP < 2.5 s on 4G mid-range Android; QR < 100 KB.
3. Accessibility pass WCAG 2.2 AA.
4. Attribution audit: "© OpenStreetMap contributors" on map; "Ola Maps" where Ola results show; TidesAtlas CC BY 4.0 line.
5. Privacy policy + consent toggles.
6. Remove all `is_seed` data from production.
7. Free-tier quota dashboard check (Ola 100K/API/month, OpenWeatherMap, Groq, Gemini).
8. Production deploy.

### Acceptance
- [ ] All previous acceptance lists still pass
- [ ] **Push to `main`, tag `phase-10` and `v1.0.0-mvp`**

---

## 5. DEFINITION OF DONE (whole MVP)
- Every feature in `docs/Crabwalk Plan.md` §2–§9 implemented, except "TBD rating" (parked) and influencer/reel reviews (skipped for MVP).
- Every `[OPEN]` either resolved in `DECISIONS.md` or explicitly deferred by the user.
- 11 tags `phase-0` … `phase-10` exist on `main`.
