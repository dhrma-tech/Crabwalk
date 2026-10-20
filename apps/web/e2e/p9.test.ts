import { expect, test, type Page } from '@playwright/test';
import { psql, signIn } from './helpers.ts';

// P9 acceptance (local stack + local tile server): planned route navigates fully offline after a pack
// download; dwell time only with explicit opt-in, revocable in Me; heatmap labels its data source every time.
// Also: live-trip nudge + skip, alerts expiry, trails GPX.
test.skip(process.env.E2E_SUPABASE !== 'local', 'needs E2E_SUPABASE=local');
test.skip(!process.env.E2E_TILES, 'needs the local tile server (pipelines/data/tiles)');
test.describe.configure({ mode: 'serial', timeout: 150_000 });

const run = Date.now().toString(36);
const email = `p9-${run}@e2e.local`;
let page: Page;
let trip = '';

test('sign in; opt in and out of dwell time in Me (revocable)', async ({ browser }) => {
	page = await (
		await browser.newContext({
			permissions: ['geolocation'],
			geolocation: { latitude: 17.0, longitude: 73.28 }
		})
	).newPage();
	await signIn(page, email);
	await page.goto('/me');
	const c = page.getByTestId('consents');
	await expect(c.getByTestId('dwell-state')).toHaveText('Off');
	await c.getByRole('button', { name: 'Turn on' }).click();
	await expect(c.getByTestId('dwell-state')).toHaveText('On');
	expect(
		psql(
			`select granted from consents c join auth.users u on u.id = c.user_id where u.email = '${email}' and c.type = 'dwell_time'`
		)
	).toBe('t');
	await c.getByRole('button', { name: 'Turn off' }).click();
	await expect(c.getByTestId('dwell-state')).toHaveText('Off');
	expect(
		psql(
			`select granted::text || (revoked_at is not null)::text from consents c join auth.users u on u.id = c.user_id where u.email = '${email}' and c.type = 'dwell_time'`
		)
	).toBe('falsetrue');
	// Without consent the server refuses dwell rows.
	const r = await page.request.post('/api/dwell', {
		data: {
			place: 'seed-fort-1',
			anon_id: crypto.randomUUID(),
			arrived_at: new Date(Date.now() - 600000).toISOString(),
			left_at: new Date().toISOString()
		}
	});
	expect(r.status()).toBe(403);
});

test('map layers: heatmap legend names Live/Typical; tide slider with attribution; trails GPX', async () => {
	await page.goto('/map');
	await page.waitForLoadState('networkidle'); // hydrated: the layers toggle registers
	await page.getByRole('button', { name: 'Map layers' }).click();
	const panel = page.getByTestId('layers-panel');
	await panel.getByLabel('Busy now').check();
	await panel.getByLabel('Tides').check();
	await expect(page.getByTestId('heat-legend')).toContainText(
		/Live: \d+ spots · Typical: \d+ spots/
	);
	await expect(page.getByTestId('heat-legend')).toContainText('Live = at least 5 people');
	await expect(page.getByTestId('tide-slider')).toContainText('Passable');
	const heat = await (await page.request.get('/api/map/heatmap?bbox=73,16.5,73.6,17.5')).json();
	for (const f of heat.features) expect(['live', 'typical']).toContain(f.properties.source);
	const trails = await (await page.request.get('/api/map/trails?bbox=72.5,15.5,74,18.5')).json();
	expect(trails.features.length).toBeGreaterThan(0);
	const gpx = await page.request.get(`/api/trails/${trails.features[0].properties.id}/gpx`);
	expect(await gpx.text()).toContain('<trkpt');
});

test('planned route navigates fully offline after pack download', async () => {
	trip = psql(
		`insert into trips (owner_id, title, days, start_date, start_point, status)
		 select id, 'P9 trip ${run}', 1, (now() at time zone 'Asia/Kolkata')::date,
		        jsonb_build_object('label', 'Start', 'lon', 73.279, 'lat', 16.999), 'saved'
		 from auth.users where email = '${email}' returning id`
	);
	psql(
		`insert into trip_stops (trip_id, day, "order", entity_type, entity_id, kind, arrive_at, depart_at)
		 select '${trip}', 1, o, 'place', p.id, 'place', now() + (o || ' hours')::interval, now() + (o || ' hours')::interval + interval '1 hour'
		 from (values ('seed-fort-1', 0), ('seed-temple-1', 1)) v(slug, o) join places p on p.slug = v.slug`
	);
	// The service worker must control the page (as for any returning user) before routes are cached.
	await page.goto('/me');
	await page.evaluate(() => navigator.serviceWorker.ready);
	await page.reload();
	// 1. Download the taluka pack in Me.
	const row = page.getByTestId('pack-row').filter({ hasText: 'Ratnagiri' });
	await row.getByRole('button', { name: 'Download' }).click();
	await expect(row.getByRole('button', { name: 'Delete' })).toBeVisible({ timeout: 30_000 });
	// 2. Open the plan once online: routes are cached for offline use.
	await page.goto(`/plan/${trip}`);
	await expect(page.getByTestId('offline-ready')).toContainText('Routes saved on this device');
	// 3. Offline: the navigation page, its route and the map tiles all come from the device.
	await page.context().setOffline(true);
	await page.goto(`/navigate?trip=${trip}&day=1&leg=1`);
	const card = page.getByTestId('nav-card');
	await expect(card).toBeVisible({ timeout: 20_000 });
	await expect(page.getByTestId('nav-left')).toContainText(/to go|away/);
	await expect(page.getByTestId('nav-steps')).toContainText(/\d+ turns/);
	await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible();
	await expect(page.getByText('This route is not available')).toHaveCount(0);
	await expect(page.getByText(/You're offline/)).toBeVisible();
	await page.context().setOffline(false);
});

test('live trip: late nudge offers to skip; skipping re-times the day', async () => {
	psql(
		`update trip_stops set arrive_at = now() - interval '45 minutes', depart_at = now() + interval '15 minutes' where trip_id = '${trip}' and "order" = 1`
	);
	psql(
		`update trip_stops set arrive_at = now() - interval '3 hours', depart_at = now() - interval '2 hours' where trip_id = '${trip}' and "order" = 0`
	);
	await page.goto(`/trip/live/${trip}`);
	await page.getByRole('button', { name: 'Start live trip' }).click();
	await expect(page.getByText('Live mode is on today')).toBeVisible();
	expect(
		psql(
			`select live_date = (now() at time zone 'Asia/Kolkata')::date from trips where id = '${trip}'`
		)
	).toBe('t');
	const nudge = page.getByTestId('nudge-late');
	await expect(nudge).toContainText(/Running \d+ min late — skip/);
	await nudge.getByRole('button', { name: 'Skip it' }).click();
	await expect(page.getByTestId('nudge-late')).toHaveCount(0);
	expect(psql(`select count(*) from trip_stops where trip_id = '${trip}'`)).toBe('1');
});

test('alerts: verifier reports one; it shows with expiry, then clears', async ({ browser }) => {
	const v = await (await browser.newContext()).newPage();
	const vEmail = `p9-ver-${run}@e2e.local`;
	await signIn(v, vEmail);
	psql(
		`insert into user_roles (user_id, role, taluka_id) select id, 'verifier', (select id from talukas where name_en = 'Ratnagiri') from auth.users where email = '${vEmail}'`
	);
	await v.goto('/admin/alerts');
	await v.getByLabel('Reason (EN)').fill(`P9 slip ${run}`);
	await v.getByLabel('Latitude').fill('17.01');
	await v.getByLabel('Longitude').fill('73.29');
	await v.getByRole('button', { name: 'Report alert' }).click();
	const rowEl = v.getByTestId('alert-row').filter({ hasText: `P9 slip ${run}` });
	await expect(rowEl).toContainText(/Reported .* · expires in \d+ hours/);
	const fc = await (await v.request.get('/api/map/alerts?bbox=73.2,16.9,73.4,17.1')).json();
	expect(
		fc.features.some(
			(f: { properties: { reason_en: string } }) => f.properties.reason_en === `P9 slip ${run}`
		)
	).toBe(true);
	await rowEl.getByRole('button', { name: 'Cleared — remove' }).click();
	await expect(rowEl).toHaveCount(0);
});
