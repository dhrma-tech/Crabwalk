import { defineConfig, devices } from '@playwright/test';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

// Shell + map checks against a production build (`--mode e2e` also serves /dev/components).
// Only public values are bound into the preview worker.
//   E2E_SUPABASE=local → use the local stack (seed data; needed for pin/tide tests)
//   PMTILES_BASE_URL   → tile host; defaults to the local tile server when pipelines/data/tiles exists
if (existsSync('../../.env')) process.loadEnvFile('../../.env');
const local = process.env.E2E_SUPABASE === 'local';
let url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
let key = process.env.SUPABASE_ANON_KEY ?? 'e2e-placeholder';
if (local) {
	const s = JSON.parse(
		execSync('pnpm exec supabase status -o json', { cwd: '../..', encoding: 'utf8' })
	);
	url = s.API_URL;
	key = s.ANON_KEY;
}
// A preview left on :4173 by an earlier run would be reused and test an old build: stop it first (main process only).
if (!process.env.CI && !process.env.TEST_WORKER_INDEX)
	execSync('node scripts/free-port.mjs 4173', { stdio: 'inherit' });
// The build prerenders /navigate through the Supabase hook, so it needs values too (CI has no .env).
process.env.SUPABASE_URL ??= url;
process.env.SUPABASE_ANON_KEY ??= key;
const localTiles = existsSync('../../pipelines/data/tiles/manifest.json');
const tiles = localTiles ? 'http://localhost:4174' : (process.env.PMTILES_BASE_URL ?? '');
process.env.E2E_TILES = tiles;

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: true,
	// One local workerd + software WebGL: more workers starve the preview server.
	workers: 3,
	// Software WebGL on shared runners: one retry in CI only (local runs stay strict).
	retries: process.env.CI ? 1 : 0,
	reporter: 'list',
	// Font rendering differs per OS, so baselines are per platform (committed: win32).
	snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{platform}{ext}',
	expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } },
	use: { baseURL: 'http://localhost:4173', ...devices['Desktop Chrome'], channel: 'chromium' },
	webServer: [
		{
			// Local stack: Crabby runs on the scripted mock provider (DECISIONS P8-2) — no real LLM calls.
			command: `pnpm exec vite build --mode e2e && pnpm run preview -b SUPABASE_URL=${url} -b SUPABASE_ANON_KEY=${key}${tiles ? ` -b PMTILES_BASE_URL=${tiles}` : ''}${local ? ' -b AI_PROVIDER=mock' : ''}`,
			url: 'http://localhost:4173',
			timeout: 180_000,
			reuseExistingServer: false
		},
		...(localTiles
			? [
					{
						command: 'node ../../pipelines/tiles/serve.ts 4174',
						url: 'http://localhost:4174/manifest.json',
						reuseExistingServer: true
					}
				]
			: [])
	]
});
