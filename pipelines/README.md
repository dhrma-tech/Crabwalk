# Laptop pipelines (BACKEND §7)

Re-runnable Node 24 scripts (TypeScript run directly). Each writes a run log to `data/<step>.log`.
`data/` and `bin/` are gitignored. Region settings live in `region.json` (no region names in code).

**Needs:** Docker Desktop running (osmium + OSRM run in containers), `pnpm install` at the repo root.

**Target DB:** local Supabase by default (`pnpm exec supabase start`). Add `--live` to write to the hosted
project (uses `supabase/.temp/pooler-url` + `SUPABASE_DB_PASSWORD` from `.env`). `PIPELINE_DB_URL` overrides both.

Run from `pipelines/`, in this order:

| Step | Command | What it does |
|---|---|---|
| 1 osm-extract | `node osm-extract/run.ts [--live]` | Downloads the Geofabrik zone (only when it changed), finds the district + taluka boundaries, cuts a buffered region extract `data/region.osm.pbf`, writes `talukas.boundary`. |
| 2 tiles | `node tiles/run.ts [--deploy] [--live]` | Cuts the region + 9 taluka packs from the latest Protomaps build into `data/tiles/` (each < 25 MiB), writes `_headers` + `manifest.json`. `--deploy` uploads to the `crabwalk-tiles` Pages project and writes `talukas.pack_url/pack_version` (needs `wrangler login`, `PMTILES_BASE_URL`). Needs `bin/pmtiles(.exe)` — [go-pmtiles releases](https://github.com/protomaps/go-pmtiles/releases). |
| 3 road-flags | `node road-flags/run.ts [--live]` | Flags ghat (name contains ghat/घाट, or inside `road-flags/ghat-zones.geojson`) and coastal (≤ 1 km from coastline) ways into `road_segments_flags` (`source='auto'`). Team rows and `excluded=true` vetoes are kept. Writes `data/highway-ways.ndjson`. |
| 4 osrm-matrix | `node osrm-matrix/run.ts [--full] [--month=N] [--live]` | Builds the OSRM car graph (when the extract changed), syncs `matrix_points` from published listings, routes every missing/changed ordered pair, applies `correction_factors` (G8 table), stores route shapes ≤ 60 km (~10 m simplified). Incremental unless `--full`. **Re-run with `--full` on 1 Jun and 1 Oct** (monsoon factor is by month). |
| 5 utility-pois | `node utility-pois/run.ts [--live]` | Imports the 11 utility types from OSM into `utility_pois` (`source='osm'`); verifier rows untouched; sets `taluka_id`. |
| tide-stations | `node tide-stations/run.ts [--live]` | Once (or when anchors change): nearest TideCheck station per coastal anchor in `region.json` → `tide_stations`. Needs `TIDECHECK_API_KEY`. |

Content (any time, DECISIONS T-50):

| Step | Command | What it does |
|---|---|---|
| content-import | `node content-import/run.ts <file.csv> [--apply] [--live]` | Places researched online, one row each, columns as in `content-import/template.csv` (export the team sheet as "CSV UTF-8"). Each new row becomes an `in_review` place marked **desk** with its sources, names (EN, MR), hours and its long English text as reviewer drafts; a reviewer still edits and publishes it in `/admin/review`. A slug already in the database is skipped, so re-running is safe. **Dry run by default** (the inserts run and roll back, so database errors show too); `--apply` writes. Rejected rows → `data/content-import-rejected.csv` (sheet row + reason). |

Template columns: `category` = a place category (`beach`, `fort`, …), `taluka` = its English name, `opens` / `closes` = `HH:MM` the same every day (or both empty), `closed_days` = e.g. `tue, wed`, yes/no flags, `monsoon_status` = `open` / `risky` / `closed` (empty = open), `source_urls` = 1–10 `https://` links separated by spaces or `;`. When taluka boundaries are loaded, the point must fall inside the named taluka.

Local tile host for dev/e2e (Range + CORS): `node tiles/serve.ts 4174`.

Tests: `pnpm test` (correction factors, pair count, CSV import). Typecheck: `pnpm check`.

Licences: OSM data © OpenStreetMap contributors (ODbL); basemap tiles via Protomaps; matrix used inside the app only.
