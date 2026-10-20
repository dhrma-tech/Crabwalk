# Crabwalk

**The Konkan, explored right.** Find hidden beaches, forts and temples with honest verdict ratings, compare
stays, eat like a local, and plan trips that respect tides, ghat roads and monsoon closures — in English,
Hindi and Marathi. Starting in Ratnagiri.

![Crabwalk screenshot](docs/design/screenshot.png) <!-- placeholder: add a 1280 px Discover screenshot -->

**Live:** `https://<project>.pages.dev` <!-- placeholder until the production deploy (docs/DEPLOY.md) -->

## Features

- **Verified listings** — every place, stay and eatery is visited and photographed by the field team;
  pages show "Verified {date}", price sources and live/typical crowd labels. No stock photos.
- **Honest ratings** — 4-level verdicts (Skip → Must visit) by traveller group; hygiene/cleanliness
  scores only from verified visitors (QR + GPS or a booking proof).
- **Map** — our own vector tiles (PMTiles), pins, clusters, utilities, busy-now heatmap, road & safety
  alerts, tides and trails; works offline from downloadable taluka packs.
- **Trip planner** — deterministic day plans that respect opening hours, tides and drive times; budget,
  group voting, share links, PDF and Google Maps export; live-trip nudges and offline turn-by-turn.
- **QR plaques** — a sub-100 KB page per spot (story, safety, nearby, verify visit, emergency share).
- **Crabby** — an AI guide that answers only from Crabwalk's own data via tools, previews every change
  (Apply / Discard), and opens the emergency card for emergency words before anything reaches the model.
- **Field-team and owner tools** — add listings on site (GPS, camera, offline queue), review queue,
  moderation, reports, claims, booking proofs, QR codes, events, alerts and planner settings.
- **Three languages, two themes** — EN / हिन्दी / मराठी with Devanagari-complete fonts; light and dark.

## Tech stack

| Layer | Choice |
|---|---|
| Web app | SvelteKit 3 (Svelte 5), TypeScript (strict), Tailwind CSS 4, Paraglide i18n |
| Hosting | Cloudflare Pages (`@sveltejs/adapter-cloudflare`), service worker + PWA |
| Data | Supabase — Postgres + PostGIS, Auth (Google, email code), Storage, Edge Functions, pg_cron |
| Map | MapLibre GL + PMTiles (Protomaps basemap built from OSM), OSRM travel matrix |
| AI | Groq (traveller chat) and Gemini (staff drafting only) behind a provider router; mock for tests |
| Validation | Zod on every endpoint and form action |
| Tests | Vitest (unit), pgTAP (database), Playwright + axe (end to end, accessibility, CSP) |

## Architecture

```
Browser (PWA) ── SvelteKit on Cloudflare Pages ──► Supabase (Postgres + RLS, Auth, Storage)
   │                 │  server loads, form actions, /api/*        ▲
   │                 ├──► Groq / Gemini (AI router, tools read our DB only)
   │                 └──► ola-proxy Worker (address search, directions; Ola never reaches AI code)
   └── PMTiles from a static tiles host (Range requests), cached per taluka for offline use
Laptop pipelines (Docker: osmium, OSRM) ──► tiles, travel matrix, utilities, trails, tide stations
Supabase Edge Functions on pg_cron ──► weather, tides, review summaries, proof cleanup, trip nudges
```

Row-level security decides who can read and write what; server code adds input validation, rate limits
and security headers (CSP, HSTS, frame denial, `X-Robots-Tag` on private pages).

```
apps/web/                 SvelteKit app
  src/routes/             pages, form actions and /api/* endpoints
  src/lib/components/     UI (Suna design system: tokens in src/app.css)
  src/lib/server/         data access, validation schemas, AI router + tools, planner
  src/service-worker/     offline shell, content and taluka-pack caches
  messages/               en / hi / mr strings
  e2e/                    Playwright suites
services/ola-proxy/       Cloudflare Worker in front of Ola Maps (key never leaves it)
supabase/migrations/      append-only schema (tables, RLS, functions, crons)
supabase/functions/       Edge Functions
supabase/tests/           pgTAP tests
pipelines/                OSM extract, tiles, road flags, OSRM matrix, POIs, trails, tides, embeddings
docs/                     decisions log, deploy runbook, design brief
scripts/                  AI-firewall check
```

Product scope, locked decisions and the build plan live in `CRABWALK_PLAN.md`, `CRABWALK_BACKEND.md`,
`CRABWALK_FRONTEND.md` and `docs/DECISIONS.md`.

## Getting started

**Prerequisites:** Node ≥ 22, pnpm 10, Docker Desktop (local Supabase; pipelines), and optionally the
Supabase CLI (installed as a dev dependency).

```bash
pnpm install
cp .env.example .env            # fill what you need; every variable is documented there
pnpm exec supabase start        # local Postgres/Auth/Storage + Mailpit on :54324
pnpm exec supabase db reset     # migrations + seed data
cd apps/web && pnpm dev         # http://localhost:5173
```

For the map locally, serve tiles built by the pipelines: `node pipelines/tiles/serve.ts 4174` and set
`PMTILES_BASE_URL=http://localhost:4174`. Without AI keys, set `AI_PROVIDER=mock` for a scripted Crabby.
Email sign-in codes arrive in Mailpit (http://127.0.0.1:54324).

**Build:** `pnpm build` (all workspaces) · **Preview:** `cd apps/web && pnpm preview`.

## Scripts

| Command | What it does |
|---|---|
| `pnpm lint` | Prettier + ESLint in every workspace, then the AI-firewall check |
| `pnpm typecheck` | `svelte-check` / `tsc` in every workspace |
| `pnpm test` | Unit tests (Vitest) in every workspace |
| `pnpm build` | Production builds |
| `pnpm db:test` | pgTAP database tests against local Supabase |
| `pnpm db:types` | Regenerate `apps/web/src/lib/db.types.ts` from the local schema |
| `cd apps/web && E2E_SUPABASE=local pnpm e2e` | Playwright suites against the local stack (stop any old preview on :4173 first) |
| `cd apps/web && pnpm exec lighthouse http://localhost:4173` | Lighthouse against a running preview |

## API overview

All endpoints live under `apps/web/src/routes/api`, validate input with Zod, answer JSON errors as
`{ "message": … }` with the right status (400 / 401 / 403 / 404 / 429), and never expose stack traces.

| Area | Endpoints |
|---|---|
| Listings | `GET /api/places`, `/api/stays`, `/api/eateries` (filters), `/api/{places,stays,eateries,dishes}/:slug`, `/api/stays/:slug/offers`, `/api/itineraries` |
| Map | `GET /api/map/{pins,search,utilities,heatmap,alerts,tides,trails}`, `/api/trails/:id/gpx`, `/api/tides/:station` |
| Ratings | `POST /api/verdicts`, `/api/subscores`, `/api/reviews`, `/api/booking-proofs`, `/api/reports` |
| Trips | `POST /api/trips/plan`, `PATCH /api/trips/:id`, `/api/trips/:id/{routes,gmaps,vote}`, `/api/trips/share/:token` |
| Crabby | `POST /api/ai/chat`, `/api/ai/actions/:id/{apply,discard}`, `/api/ai/price-tip` |
| Offline & push | `GET /api/packs`, `/api/packs/:id/data`, `POST /api/push/subscribe`, `/api/dwell` |
| Staff & owners | `/api/admin/{places,stays,eateries,photos,drafts/:id/approve,taluka-at}`, `/api/owner/{claim,listing/:id}` |
| QR | `/q/:code` (HTML), `POST /q/:code/{scan,visit,report}` |

Write endpoints are rate-limited per client (keys are HMACs, no IPs stored).

## Deployment

Guided, step by step, in [`docs/DEPLOY.md`](docs/DEPLOY.md): Supabase (db push, Vault secrets, Edge
Functions, auth URLs, SMTP), data pipelines with `--live`, tiles host, the ola-proxy Worker, then the
Cloudflare Pages project with its environment variables. Remove seed data before launch
(`pipelines/seed-cleanup`).

## Contributing

Work on a branch and open a pull request against `main`. Before pushing, run `pnpm lint`,
`pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm db:test`; run the e2e suite for UI or flow changes.
Use conventional commits (`feat:`, `fix:`, `perf:` …). Migrations are append-only. Keep the hard rules in
`CLAUDE.md` §2 (₹0 budget, AI firewall, no Ola tiles, no fake live data, no stock photos, no secrets in git)
and log decisions in `docs/DECISIONS.md`.

## License

No license has been chosen yet — all rights reserved until the owner adds one. Third-party data and fonts
keep their own licences: OpenStreetMap data © OpenStreetMap contributors (ODbL); fonts under the SIL Open
Font License (`apps/web/static/fonts/OFL.txt`).
