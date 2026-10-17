import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';

// P3 acceptance: map renders from our own PMTiles, never Ola tiles; attribution visible; tide attribution
// next to tide data. Pin/tide checks need the local stack (E2E_SUPABASE=local) for seed data.
const tiles = process.env.E2E_TILES ?? '';
const local = process.env.E2E_SUPABASE === 'local';
const psql = (sql: string) =>
	execFileSync('docker', ['exec', 'supabase_db_crabwalk', 'psql', '-U', 'postgres', '-qtAc', sql], {
		encoding: 'utf8'
	}).trim();

test.skip(!tiles, 'no tile host (build tiles or set PMTILES_BASE_URL)');
test.describe.configure({ timeout: 60_000 });

test('map loads only our PMTiles (Range) and never Ola tiles', async ({ page }) => {
	const urls: string[] = [];
	const ranged: string[] = [];
	page.on('request', (r) => {
		urls.push(r.url());
		if (r.headers().range && r.url().startsWith(tiles)) ranged.push(r.url());
	});
	await page.goto('/map');
	await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible({ timeout: 20_000 });
	await page.waitForLoadState('networkidle');

	expect(ranged.some((u) => u.endsWith('.pmtiles'))).toBe(true);
	expect(urls.filter((u) => /olamaps|olakrutrim|\/tiles\/v1\//i.test(u))).toEqual([]);
	await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText(
		'© OpenStreetMap contributors'
	);
});

test('anonymous Ola search is refused (login-only)', async ({ request }) => {
	expect((await request.get('/ola/autocomplete?q=ganpatipule')).status()).toBe(401);
});

test('map API validates input', async ({ request }) => {
	expect((await request.get('/api/map/pins?bbox=1,2')).status()).toBe(400);
	expect((await request.get('/api/map/utilities?bbox=73,16,74,17')).status()).toBe(400);
	expect((await request.get('/api/map/pins?bbox=73,16,74,17&kinds=spaceship')).status()).toBe(400);
});

test.describe('with seed data', () => {
	test.skip(!local, 'needs E2E_SUPABASE=local');

	test('pins load, filters apply, utility layer toggles', async ({ request }) => {
		const all = await (await request.get('/api/map/pins?bbox=72.9,16.4,73.96,18.17')).json();
		expect(all.features.length).toBeGreaterThan(0);
		const stays = await (
			await request.get('/api/map/pins?bbox=72.9,16.4,73.96,18.17&kinds=stay')
		).json();
		expect(
			stays.features.every((f: { properties: { kind: string } }) => f.properties.kind === 'stay')
		).toBe(true);
		const hosp = await (
			await request.get('/api/map/utilities?bbox=72.9,16.4,73.96,18.17&types=hospital')
		).json();
		expect(hosp.features.length).toBeGreaterThan(0);
	});

	test('pin sheet shows today’s tides with provider attribution', async ({ page }) => {
		// One station + today's extremes on the first seed place (what tide-refresh writes daily).
		const placeId = psql(
			`select id from places where status = 'published' and is_seed order by slug limit 1`
		);
		const station =
			psql(
				`insert into tide_stations (name, location, provider_station_id) values ('e2e', extensions.st_makepoint(73.29, 16.99)::extensions.geography, 'e2e')
			 on conflict do nothing returning id`
			) || psql(`select id from tide_stations where provider_station_id = 'e2e'`);
		psql(`update places set tide_station_id = '${station}' where id = '${placeId}'`);
		psql(
			`insert into tide_cache (station_id, date, extremes, provider) values ('${station}', (now() at time zone 'Asia/Kolkata')::date,
			 '[{"type":"high","time":"2026-10-17T04:12:00Z","height_m":2.1},{"type":"low","time":"2026-10-17T10:40:00Z","height_m":0.4}]', 'tidecheck')
			 on conflict (station_id, date) do update set extremes = excluded.extremes, fetched_at = now()`
		);
		const lonlat = psql(
			`select extensions.st_x(location::extensions.geometry) || ',' || extensions.st_y(location::extensions.geometry) from places where id = '${placeId}'`
		)
			.split(',')
			.map(Number);

		await page.goto('/map');
		await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible({ timeout: 20_000 });
		await page.waitForLoadState('networkidle');
		// Zoom to the place so it isn't clustered, then click its pin at the map centre.
		await page.evaluate(
			([lon, lat]) => window.dispatchEvent(new CustomEvent('e2e:fly', { detail: { lon, lat } })),
			lonlat
		);
		await page.waitForResponse((r) => r.url().includes('/api/map/pins'), { timeout: 20_000 });
		await page.waitForTimeout(1000);
		const box = (await page.getByTestId('map').boundingBox())!;
		await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
		await expect(page.getByTestId('pin-sheet')).toBeVisible({ timeout: 10_000 });
		await expect(page.getByTestId('tides')).toContainText('Tide data by TideCheck');
		await expect(page.getByRole('link', { name: 'Tide data by TideCheck' })).toHaveAttribute(
			'href',
			'https://tidecheck.com'
		);
	});
});
