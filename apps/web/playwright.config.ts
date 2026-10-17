import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

// P2 shell checks against a production build (`--mode e2e` also serves /dev/components).
// Only the two public Supabase values are bound into the preview worker.
if (existsSync('../../.env')) process.loadEnvFile('../../.env');
const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const key = process.env.SUPABASE_ANON_KEY ?? 'e2e-placeholder';

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: true,
	reporter: 'list',
	// Font rendering differs per OS, so baselines are per platform (committed: win32).
	snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{platform}{ext}',
	expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } },
	use: { baseURL: 'http://localhost:4173', ...devices['Desktop Chrome'], channel: 'chromium' },
	webServer: {
		command: `pnpm exec vite build --mode e2e && pnpm run preview -b SUPABASE_URL=${url} -b SUPABASE_ANON_KEY=${key}`,
		url: 'http://localhost:4173',
		timeout: 180_000,
		reuseExistingServer: !process.env.CI
	}
});
