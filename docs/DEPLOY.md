# Crabwalk — production deploy runbook (P10)

Guided deploy (DECISIONS P10-1): each step is run with the owner's approval; secrets live only in the
local `.env`, Supabase function secrets / Vault, and Cloudflare env vars — never in git.
Production URL: Cloudflare Pages `*.pages.dev` (P10-2). Shell: Git Bash from the repo root.

## 0. Accounts and keys (owner)

| Need | Where | Notes |
|---|---|---|
| Supabase project `crabwalk` (ref `uwaqcutysdcmxfjpfktt`, ap-south-1) | exists (P1-10) | `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN` in `.env` |
| Cloudflare account | dash.cloudflare.com | `wrangler login` (browser) |
| Groq API key | console.groq.com | free plan; check limits page |
| Gemini API key | aistudio.google.com | staff drafting only (P8-1) |
| OpenWeatherMap key | openweathermap.org | 2.5 endpoints, no card (A7) |
| TideCheck key | tidecheck.com | confirm commercial use (P3-1) |
| Ola Maps key | maps.olakrutrim.com | goes only to `services/ola-proxy` |
| SMTP (Resend or Brevo) | free tier | sender domain/address (P1-19) |
| Google OAuth client | exists (P1-21) | add the pages.dev redirect |

## 1. Local secrets
Fill `.env` (see `.env.example`). Generate once if missing: `RATE_LIMIT_SALT` (32 random bytes hex),
`CRON_SECRET` (random), VAPID keys (already generated locally, P9-3) and set `VAPID_SUBJECT=https://<app>.pages.dev`.

## 2. Database (Supabase live)
```bash
npx supabase link --project-ref uwaqcutysdcmxfjpfktt
npx supabase db push --dry-run          # review: P3 … P10 migrations
npx supabase db push
```
Vault secrets used by the crons (`app.invoke_edge`), in the SQL editor:
```sql
select vault.create_secret('https://uwaqcutysdcmxfjpfktt.supabase.co', 'project_url');
select vault.create_secret('<CRON_SECRET>', 'cron_secret');
```
Auth: set `site_url` / `additional_redirect_urls` to `https://<app>.pages.dev` (+ `/auth/callback`), enable
`[auth.email.smtp]` with the SMTP creds, then `npx supabase config push`. Verify the 6-digit email template.

## 3. Edge functions
Cron functions check `CRON_SECRET` themselves, so deploy them without gateway JWT checks:
```bash
for f in weather-refresh tide-refresh booking-proof-cleanup review-summaries trip-nudges; do
  npx supabase functions deploy $f --no-verify-jwt
done
npx supabase secrets set CRON_SECRET=… OPENWEATHER_API_KEY=… TIDECHECK_API_KEY=… TIDE_PROVIDER=tidecheck \
  GROQ_API_KEY=… AI_MODEL_INTENT=llama-3.1-8b-instant AI_MODEL_EXPLAIN=llama-3.3-70b-versatile \
  VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=https://<app>.pages.dev
```
Check: `select jobname, schedule from cron.job;` lists weather-refresh, tide-refresh, booking-proof-cleanup,
review-summaries, trip-nudges, refresh-patterns; after the next run, `cron.job_run_details` shows success.

## 4. Data pipelines (`pipelines/`, `--live`)
```bash
cd pipelines
node utility-pois/run.ts --live
node road-flags/run.ts --live
node osrm-matrix/run.ts --live --full     # corrected times + route shapes + turn cues (P9-2)
node tide-stations/run.ts --live          # needs TIDECHECK_API_KEY
node trails/run.ts --live
node embeddings/run.ts --live
node seed-cleanup/run.ts --live           # dry run: review counts
node seed-cleanup/run.ts --live --apply   # PLAN P10 task 6 — only after the owner confirms the counts
```
Report the matrix size (A4): `select pg_size_pretty(pg_total_relation_size('travel_matrix'));`.

## 5. Tiles (Cloudflare Pages project `crabwalk-tiles`)
```bash
pnpm --dir apps/web exec wrangler login
PMTILES_BASE_URL=https://crabwalk-tiles.pages.dev node pipelines/tiles/run.ts --deploy --live
curl.exe -s -D - -o NUL -r 0-99 https://crabwalk-tiles.pages.dev/rtn.pmtiles   # must be 206 (P3-7)
```

## 6. Ola proxy (Cloudflare Worker)
```bash
cd services/ola-proxy && pnpm exec wrangler deploy && pnpm exec wrangler secret put OLA_API_KEY
```
Note the worker URL → `OLA_PROXY_URL`. Verify one autocomplete + one directions call while signed in (P3-6).

## 7. Web app (Cloudflare Pages project `crabwalk`)
Env vars (production): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PMTILES_BASE_URL`, `OLA_PROXY_URL`, `GROQ_API_KEY`,
`GEMINI_API_KEY`, `AI_MODEL_INTENT`, `AI_MODEL_EXPLAIN`, `AI_MODEL_DRAFT`, `VAPID_PUBLIC_KEY`, `RATE_LIMIT_SALT`,
`AGODA_ENABLED=false`. **Leave `AI_PROVIDER` unset** (mock is local-only, P8-14).
```bash
cd apps/web && pnpm build && pnpm exec wrangler pages deploy .svelte-kit/cloudflare --project-name crabwalk --branch main
```

## 8. Verify in production
- Sign in with Google and with an email code; Me → preferences, packs download, consents.
- Place page, map layers, QR page (`/q/<code>`) on a phone; Crabby answers one question (real Groq).
- Navigate a saved trip with the phone offline after a pack download (P9 acceptance).
- Push reminder on Android Chrome and an installed iPhone PWA (P9).
- Headers: `curl.exe -sI https://<app>.pages.dev | findstr /i "content-security x-frame strict-transport"`.
- Lighthouse mobile on `/`, `/place/<slug>`, `/stays` — LCP < 2.5 s (FRONTEND §11).

## 9. Free-tier quota check (PLAN P10 task 7)
| Service | Free limit (check dashboard) | Our expected use | Guard |
|---|---|---|---|
| Ola Maps | 100K calls / API / month | signed-in search fallback + non-DB navigation only | 30 req/min/user in proxy; own DB searched first |
| OpenWeatherMap (2.5 free) | 60 calls/min, 1M calls/month | ~480/day ≈ 15K/month (20 points hourly, P3-5) | cron cadence |
| TideCheck | per plan | 1 call/station/day | daily cron, 24 h cache rule |
| Groq | per-model RPM/RPD (console) | ≤ 20 msgs/user/day × ~3 calls + nightly summaries ≤ 40 | daily cap, 429 fall-through, stop on 429 |
| Gemini | per-model RPD | staff drafting only | manual trigger |
| Supabase | 500 MB DB, 1 GB storage, 500K function calls | matrix + photos dominate | photo WebP sizes; matrix ≤ 60 km shapes |
| Cloudflare Pages/Workers | 100K requests/day (Workers) | SSR + ola-proxy | caching headers on public reads |

Record actual numbers in `docs/DECISIONS.md` after one week live.

## 10. Finish
`git tag v1.0.0-mvp && git push origin v1.0.0-mvp` only after section 8 passes.

## Rollback
- Web: `wrangler pages deployment list` → promote the previous deployment.
- DB: migrations are append-only; fix forward with a new migration. Seed cleanup is irreversible — keep the dry-run output.
