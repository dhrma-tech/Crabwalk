import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { psql, signIn } from './helpers.ts';

// P10: WCAG 2.2 AA (axe, light + dark, EN + MR) and zero CSP violations on every main screen;
// security headers present; attribution where third-party data shows.
test.skip(process.env.E2E_SUPABASE !== 'local', 'needs E2E_SUPABASE=local');
test.describe.configure({ timeout: 180_000 });

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function audit(page: Page, path: string) {
	await page.addInitScript(() => {
		(window as unknown as { __csp: string[] }).__csp = [];
		document.addEventListener('securitypolicyviolation', (e) =>
			(window as unknown as { __csp: string[] }).__csp.push(
				`${e.violatedDirective} ${e.blockedURI}`
			)
		);
	});
	await page.goto(path);
	await page.waitForLoadState('networkidle');
	const axe = await new AxeBuilder({ page })
		.withTags(TAGS)
		.exclude('.maplibregl-canvas') // the map canvas itself is not DOM content
		.analyze();
	const csp = await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []);
	return {
		violations: axe.violations.map(
			(v) =>
				`${v.id} (${v.impact}): ${v.nodes
					.map((n) => n.target.join(' '))
					.slice(0, 3)
					.join(' | ')}`
		),
		csp
	};
}

const QR =
	process.env.E2E_SUPABASE === 'local'
		? psql("select code from qr_codes where entity_type = 'place' limit 1")
		: '';
const PUBLIC = [
	...(QR ? [`/q/${QR}`] : []),
	'/',
	'/map',
	'/place/seed-fort-1',
	'/stays',
	'/food',
	'/taste-konkan',
	'/itineraries',
	'/start',
	'/privacy',
	'/login',
	'/crabby',
	'/navigate?to=17,73.3&name=Test',
	'/dev/components' // every component in every state (e2e builds only)
];

for (const scheme of ['light', 'dark'] as const)
	for (const locale of ['en', 'mr'] as const)
		test(`public screens: axe + CSP (${scheme}, ${locale})`, async ({ browser }) => {
			const ctx = await browser.newContext({ colorScheme: scheme });
			await ctx.addCookies([
				{ name: 'PARAGLIDE_LOCALE', value: locale, url: 'http://localhost:4173' }
			]);
			const page = await ctx.newPage();
			const problems: string[] = [];
			for (const path of PUBLIC) {
				const r = await audit(page, path);
				problems.push(
					...r.violations.map((v) => `${path}: ${v}`),
					...r.csp.map((c) => `${path}: CSP ${c}`)
				);
			}
			expect(problems, problems.join('\n')).toEqual([]);
			await ctx.close();
		});

test('signed-in screens: axe + CSP', async ({ browser }) => {
	const ctx = await browser.newContext();
	const page = await ctx.newPage();
	const email = `p10-${Date.now()}@e2e.local`;
	await signIn(page, email);
	psql(
		`insert into user_roles (user_id, role) select id, 'admin' from auth.users where email = '${email}'`
	);
	const trip = psql(
		`insert into trips (owner_id, title, days, start_date, start_point, status) select id, 'P10', 1, (now() at time zone 'Asia/Kolkata')::date, jsonb_build_object('label','Start','lon',73.279,'lat',16.999), 'saved' from auth.users where email = '${email}' returning id`
	);
	psql(
		`insert into trip_stops (trip_id, day, "order", entity_type, entity_id, kind) select '${trip}', 1, 0, 'place', id, 'place' from places where slug = 'seed-fort-1'`
	);
	const problems: string[] = [];
	for (const path of [
		'/me',
		'/plan/new',
		`/plan/${trip}`,
		`/trip/live/${trip}`,
		'/admin',
		'/admin/alerts',
		'/admin/qr'
	]) {
		const r = await audit(page, path);
		problems.push(
			...r.violations.map((v) => `${path}: ${v}`),
			...r.csp.map((c) => `${path}: CSP ${c}`)
		);
	}
	expect(problems, problems.join('\n')).toEqual([]);
	await ctx.close();
});

test('security headers on pages, API and the QR page', async ({ request }) => {
	for (const path of ['/', '/api/places', '/privacy']) {
		const h = (await request.get(path)).headers();
		expect(h['x-content-type-options'], path).toBe('nosniff');
		expect(h['referrer-policy'], path).toBe('strict-origin-when-cross-origin');
		expect(h['x-frame-options'], path).toBe('DENY');
	}
	const page = (await request.get('/')).headers();
	expect(page['content-security-policy']).toMatch(/frame-ancestors 'none'/);
	const code = psql(`select code from qr_codes where entity_type = 'place' limit 1`);
	if (code) {
		const q = (await request.get(`/q/${code}`)).headers();
		expect(q['content-security-policy']).toMatch(/script-src 'sha256-/);
		expect(q['content-security-policy']).toMatch(/default-src 'none'/);
	}
});

test('attribution: OSM on the map; tide provider next to tide data', async ({ page }) => {
	test.skip(!process.env.E2E_TILES, 'no tile host (build tiles or set PMTILES_BASE_URL)');
	await page.goto('/map');
	await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText('OpenStreetMap', {
		timeout: 15_000
	});
	await page.getByRole('button', { name: 'Map layers' }).click();
	await page.getByTestId('layers-panel').getByLabel('Tides').check();
	const tides = page.getByTestId('tide-slider');
	await expect(tides).toBeVisible();
	const tideRows = psql(
		`select count(*) from tide_cache where date = (now() at time zone 'Asia/Kolkata')::date`
	);
	if (tideRows !== '0') await expect(tides).toContainText(/Tide data/);
});
