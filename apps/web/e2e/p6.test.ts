import { expect, test } from '@playwright/test';
import { psql, signIn } from './helpers.ts';

// P6 acceptance (local stack): scan page < 100 KB / no webfonts / no framework; works with no login;
// emergency calls 112 and shares location; GPS-verified visit (199 m pass, 250 m fail); QR reports; /start.
test.skip(process.env.E2E_SUPABASE !== 'local', 'needs E2E_SUPABASE=local');
test.describe.configure({ mode: 'serial', timeout: 90_000 });

const run = Date.now().toString(36);
const n = String(Date.now() % 1e6).padStart(6, '0');
const T = `(select id from talukas where name_en = 'Ratnagiri')`;
const CODE = `TST-${n}`;
const STATION = `TST-${n}9`;
const LAT = 17.05;
const LNG = 73.29;

test.beforeAll(() => {
	const id = psql(
		`insert into places (slug, category, taluka_id, location, status, monsoon_status, monsoon_reason)
		 values ('e2e-qr-${run}', 'fort', ${T}, 'SRID=4326;POINT(${LNG} ${LAT})', 'published', 'risky', 'Slippery steps')
		 returning id`
	);
	psql(
		`insert into place_translations (place_id, lang, name, short_story, dos, donts)
		 values ('${id}', 'en', 'E2E QR Fort ${run}', 'Built in 1600.', 'Carry water.', 'No littering.')`
	);
	const sponsor = psql(`insert into sponsors (name) values ('E2E Homestay ${run}') returning id`);
	psql(
		`insert into qr_codes (code, entity_type, entity_id, sponsor_id) values ('${CODE}', 'place', '${id}', '${sponsor}')`
	);
	const st = psql(
		`insert into utility_pois (type, location, name, source, taluka_id)
		 values ('railway_station', 'SRID=4326;POINT(${LNG + 0.02} ${LAT})', 'E2E Station', 'osm', ${T}) returning id`
	);
	psql(
		`insert into qr_codes (code, entity_type, entity_id) values ('${STATION}', 'station', '${st}')`
	);
});

test('scan page: < 100 KB, no webfonts, no framework, no login, scan recorded', async ({
	page
}) => {
	const responses: { url: string; size: number }[] = [];
	page.on('response', async (r) => {
		const body = await r.body().catch(() => Buffer.alloc(0));
		responses.push({ url: r.url(), size: body.length });
	});
	await page.goto(`/q/${CODE}`);
	await page.waitForLoadState('networkidle');

	await expect(page.getByRole('heading', { level: 1 })).toHaveText(`E2E QR Fort ${run}`);
	await expect(page.getByText('Built in 1600.')).toBeVisible();
	await expect(page.getByText(`Supported by E2E Homestay ${run}`)).toBeVisible();
	const total = responses.reduce((s, r) => s + r.size, 0);
	expect(total, JSON.stringify(responses)).toBeLessThan(100 * 1024);
	expect(responses.some((r) => /\.woff2?|\/fonts\//.test(r.url))).toBe(false);
	expect(responses.some((r) => r.url.includes('/_app/'))).toBe(false);
	await expect.poll(() => psql(`select count(*) from qr_scans where code = '${CODE}'`)).toBe('1');
});

test('emergency: tel:112 and share location (GPS, then place location when GPS is denied)', async ({
	browser
}) => {
	const ctx = await browser.newContext({
		permissions: ['geolocation'],
		geolocation: { latitude: 17.1234, longitude: 73.4321 }
	});
	await ctx.addInitScript(() => {
		(navigator as unknown as { share: (d: { text: string }) => Promise<void> }).share = (d) => {
			(window as unknown as { shared: string }).shared = d.text;
			return Promise.resolve();
		};
	});
	const page = await ctx.newPage();
	await page.goto(`/q/${CODE}`);
	await expect(page.getByRole('link', { name: 'Call 112' })).toHaveAttribute('href', 'tel:112');
	await page.getByRole('button', { name: 'Share my location' }).click();
	await expect
		.poll(() => page.evaluate(() => (window as unknown as { shared?: string }).shared))
		.toContain('https://maps.google.com/?q=17.12340,73.43210');
	await ctx.close();

	const denied = await browser.newContext();
	await denied.addInitScript(() => {
		(navigator as unknown as { share: (d: { text: string }) => Promise<void> }).share = (d) => {
			(window as unknown as { shared: string }).shared = d.text;
			return Promise.resolve();
		};
		navigator.geolocation.getCurrentPosition = (_ok, no) =>
			no?.({ code: 1, message: 'denied' } as GeolocationPositionError);
	});
	const p2 = await denied.newPage();
	await p2.goto(`/q/${CODE}`);
	await p2.getByRole('button', { name: 'Share my location' }).click();
	await expect
		.poll(() => p2.evaluate(() => (window as unknown as { shared?: string }).shared))
		.toContain(`?q=${LAT.toFixed(5)},${LNG.toFixed(5)}`);
	await denied.close();
});

test('verified visit: anon asked to sign in; 250 m fails; 199 m passes', async ({ browser }) => {
	const anon = await browser.newContext({
		permissions: ['geolocation'],
		geolocation: { latitude: LAT, longitude: LNG }
	});
	const a = await anon.newPage();
	await a.goto(`/q/${CODE}`);
	await a.getByRole('button', { name: /verify/ }).click();
	await expect(a.getByText('Sign in to verify your visit, then scan again.')).toBeVisible();
	await anon.close();

	const email = `qr-${run}@e2e.local`;
	const ctx = await browser.newContext({
		permissions: ['geolocation'],
		geolocation: { latitude: LAT + 0.00225, longitude: LNG }
	});
	const page = await ctx.newPage();
	await signIn(page, email);
	await page.goto(`/q/${CODE}`);
	await page.getByRole('button', { name: /verify/ }).click();
	await expect(page.getByText(/You are about 2\d\d m away/)).toBeVisible();

	await ctx.setGeolocation({ latitude: LAT + 0.0018, longitude: LNG });
	await page.getByRole('button', { name: /verify/ }).click();
	await expect(page.getByText('Visit verified. Thank you!')).toBeVisible();
	expect(
		psql(
			`select count(*) from verified_visits v join auth.users u on u.id = v.user_id
			 where u.email = '${email}' and v.method = 'qr_gps' and v.distance_m between 195 and 200`
		)
	).toBe('1');
	await ctx.close();
});

test('report a problem works without JS and is tagged with the QR code', async ({ browser }) => {
	const ctx = await browser.newContext({ javaScriptEnabled: false });
	const page = await ctx.newPage();
	await page.goto(`/q/${CODE}`);
	await page.getByText('Report a problem').first().click();
	await page.getByLabel('QR code broken').check();
	await page.getByRole('button', { name: 'Send report' }).click();
	await expect(page.getByText('Thanks — a verifier will check this.')).toBeVisible();
	expect(psql(`select type from reports where qr_code = '${CODE}'`)).toBe('broken_qr');
	await ctx.close();
});

test('station code opens "Start your Konkan trip"', async ({ page }) => {
	await page.goto(`/q/${STATION}`);
	await expect(page).toHaveURL(new RegExp(`/start\\?from=${STATION}$`));
	await expect(
		page.getByRole('heading', { name: 'Start your Konkan trip', level: 1 })
	).toBeVisible();
	await expect(page.getByRole('link', { name: 'Plan my trip' })).toBeVisible();
	expect(psql(`select count(*) from qr_scans where code = '${STATION}'`)).toBe('1');
});

test('admin creates a code (region prefix) and prints its plaque', async ({ page }) => {
	const email = `qradmin-${run}@e2e.local`;
	await signIn(page, email);
	psql(
		`insert into user_roles (user_id, role) select id, 'admin' from auth.users where email = '${email}'`
	);
	await page.goto('/admin/qr?type=place');
	await page.getByLabel('Listing or stop').selectOption({ label: `E2E QR Fort ${run}` });
	await page.getByRole('button', { name: 'Create code' }).click();
	const status = page.getByRole('status').filter({ hasText: /^RTN-\d{3,}$/ });
	await expect(status).toBeVisible();
	const code = (await status.textContent())!;

	const res = await page.request.get(`/admin/qr/${code}/plaque`);
	expect(res.headers()['content-type']).toContain('image/svg+xml');
	const svg = await res.text();
	expect(svg).toContain(`E2E QR Fort ${run}`);
	expect(svg).toContain(`/q/${code}`);
	expect(svg).toContain('112');
	expect(svg).toMatch(/<path d="M[\d.]+ [\d.]+h/);
	psql(`delete from qr_codes where code = '${code}'`);
});
