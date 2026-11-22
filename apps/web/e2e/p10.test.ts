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
	'/discover',
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
		'/admin/qr',
		'/admin/planner'
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

test('planner readiness numbers; estimated drive times are labelled (T2-08)', async ({
	browser
}) => {
	const ctx = await browser.newContext();
	const page = await ctx.newPage();
	const email = `p10-ready-${Date.now()}@e2e.local`;
	await signIn(page, email);
	psql(
		`insert into user_roles (user_id, role) select id, 'admin' from auth.users where email = '${email}'`
	);
	await page.goto('/admin/planner');
	const panel = page.getByTestId('planner-readiness');
	const n = (k: string) => psql(`select public.planner_readiness()->>'${k}'`);
	await expect(panel.locator('dd')).toHaveText([
		n('published'),
		n('no_matrix_point'),
		n('no_hours'),
		n('no_seasonal'),
		`${n('tide_no_rule')} / ${n('tide_dependent')}`
	]);

	const trip = psql(
		`insert into trips (owner_id, title, days, start_date, start_point, status) select id, 'P10 legs', 1, (now() at time zone 'Asia/Kolkata')::date, jsonb_build_object('label','Start','lon',73.279,'lat',16.999), 'saved' from auth.users where email = '${email}' returning id`
	);
	const stop = (order: number, slug: string, s: number, source: string) =>
		psql(
			`insert into trip_stops (trip_id, day, "order", entity_type, entity_id, kind, travel_from_prev_s, travel_source)
			 select '${trip}', 1, ${order}, 'place', id, 'place', ${s}, '${source}' from places where slug = '${slug}'`
		);
	stop(0, 'seed-fort-1', 1200, 'estimate');
	stop(1, 'seed-temple-1', 600, 'road');
	await page.goto(`/plan/${trip}`);
	await expect(page.getByText('20 min drive').first()).toBeVisible();
	await expect(page.getByTestId('travel-estimated')).toHaveCount(1);
	await expect(page.getByTestId('travel-estimated')).toContainText('estimated');
	await ctx.close();
});

test('stamps on Me: one per place checked in at, newest first; new ones pop once (T3-04)', async ({
	browser
}) => {
	const ctx = await browser.newContext();
	const page = await ctx.newPage();
	const email = `p10-stamps-${Date.now()}@e2e.local`;
	await signIn(page, email);
	await page.goto('/me');
	await expect(page.getByTestId('my-stamps')).toContainText('Check in at a place');
	const visit = (slug: string, ago: string) =>
		psql(
			`insert into verified_visits (user_id, entity_type, entity_id, method, distance_m, created_at)
			 select u.id, 'place', p.id, 'qr_gps', 20, now() - interval '${ago}'
			 from auth.users u, places p where u.email = '${email}' and p.slug = '${slug}'`
		);
	visit('seed-fort-1', '3 days');
	visit('seed-fort-1', '1 hour'); // a second visit to the same place: still one stamp
	visit('seed-beach-1', '1 day');
	await page.goto('/me');
	const stamps = page.getByTestId('stamp');
	await expect(stamps).toHaveCount(2);
	await expect(stamps.first()).toContainText('Seed Beach 1');
	await expect(page.locator('[data-testid="stamp"][data-fresh]')).toHaveCount(2);
	await page.reload();
	await expect(stamps).toHaveCount(2);
	await expect(page.locator('[data-testid="stamp"][data-fresh]')).toHaveCount(0);
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
	// SEC-10 / SEC-24: exact hosts only, violations reported, isolation headers.
	expect(page['content-security-policy']).not.toMatch(/\*\.supabase\.co|\*\.pages\.dev/);
	expect(page['content-security-policy']).toMatch(/report-uri \/api\/csp-report/);
	expect(page['cross-origin-opener-policy']).toBe('same-origin');
	expect(page['cross-origin-resource-policy']).toBe('same-site');
	const report = await request.post('/api/csp-report', {
		headers: { 'content-type': 'application/csp-report' },
		data: JSON.stringify({
			'csp-report': {
				'effective-directive': 'img-src',
				'blocked-uri': 'https://evil.example/x.png?t=1',
				'document-uri': 'http://localhost:4173/plan/share/abcdefghijklmnopqrstuvwxyz?x=1'
			}
		})
	});
	expect(report.status()).toBe(204);
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

test('service worker: private pages are never cached; sign-out purges cached pages (SEC-09)', async ({
	browser
}) => {
	const ctx = await browser.newContext();
	const page = await ctx.newPage();
	await signIn(page, `sw-${Date.now().toString(36)}@e2e.local`);
	await page.goto('/');
	await page.evaluate(() => navigator.serviceWorker.ready);
	await page.reload(); // from here on the worker controls the page
	await page.waitForFunction(() => !!navigator.serviceWorker.controller);
	await page.goto('/stays');
	await page.goto('/me');
	const cached = () =>
		page.evaluate(async () => {
			const out: string[] = [];
			for (const k of await caches.keys())
				if (k.startsWith('pages-'))
					for (const r of await (await caches.open(k)).keys()) out.push(new URL(r.url).pathname);
			return out;
		});
	await expect.poll(cached).toContain('/stays');
	expect(await cached()).not.toContain('/me');

	await page.waitForLoadState('networkidle'); // hydrated: the sign-out form purges before it posts
	await page.getByRole('button', { name: 'Sign out' }).click();
	// The form purges the caches, then posts; sign-out lands on /login.
	await page.waitForURL('**/login');
	await page.waitForLoadState('networkidle');
	expect(await cached()).not.toContain('/stays');
	expect(await cached()).not.toContain('/me');
	await ctx.setOffline(true);
	// Nothing of the old session opens offline: /me is not in any cache, so the navigation simply fails.
	await expect(page.goto('/me')).rejects.toThrow();
	await ctx.close();
});

test('shared trip page and API: title and start label, no start coordinates (SEC-17)', async ({
	request
}) => {
	const token = Date.now().toString(16).padStart(32, '0').slice(-32);
	psql(
		`with u as (insert into auth.users (id, email) values (gen_random_uuid(), 'share-${token}@e2e.local') returning id)
		 insert into trips (owner_id, title, days, start_point, share_token)
		 select id, 'Shared ${token}', 1, jsonb_build_object('label', 'Sea View Home', 'lon', 73.301234, 'lat', 16.991234), '${token}' from u`
	);
	const html = await (await request.get(`/plan/share/${token}`)).text();
	expect(html).toContain(`Shared ${token}`);
	expect(html).toContain('Sea View Home');
	const api = await (await request.get(`/api/trips/share/${token}`)).text();
	for (const body of [html, api]) expect(body).not.toMatch(/73\.3012|16\.9912/);
	psql(`delete from trips where share_token = '${token}'`);
});

test('copy a shared trip: the viewer gets their own trip with the same stops (T3-06)', async ({
	browser
}) => {
	const token = (Date.now() + 1).toString(16).padStart(32, '0').slice(-32);
	const owner = psql(
		`with u as (insert into auth.users (id, email) values (gen_random_uuid(), 'share-copy-${token}@e2e.local') returning id)
		 insert into trips (owner_id, title, days, start_date, start_point, share_token)
		 select id, 'Copy me ${token}', 2, (now() at time zone 'Asia/Kolkata')::date + 10,
		        jsonb_build_object('label', 'Ratnagiri', 'lon', 73.33, 'lat', 16.99), '${token}' from u returning id`
	);
	const stop = (day: number, order: number, slug: string) =>
		psql(
			`insert into trip_stops (trip_id, day, "order", entity_type, entity_id, kind)
			 select '${owner}', ${day}, ${order}, 'place', id, 'place' from places where slug = '${slug}'`
		);
	stop(1, 0, 'seed-fort-1');
	stop(1, 1, 'seed-temple-1');
	stop(2, 0, 'seed-beach-1');
	const ctx = await browser.newContext();
	const page = await ctx.newPage();
	const email = `p10-copy-${Date.now()}@e2e.local`;
	await signIn(page, email);
	await page.goto(`/plan/share/${token}`);
	await page.getByTestId('copy-trip').click();
	await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}$/);
	const copy = page.url().split('/').at(-1)!;
	expect(copy).not.toBe(owner);
	const stops = (trip: string) =>
		psql(
			`select string_agg(day || ':' || p.slug, ',' order by day, "order") from trip_stops s
			 join places p on p.id = s.entity_id where s.trip_id = '${trip}'`
		);
	expect(stops(copy)).toBe('1:seed-fort-1,1:seed-temple-1,2:seed-beach-1');
	expect(
		psql(
			`select t.title || '|' || (u.email = '${email}') || '|' || t.days from trips t join auth.users u on u.id = t.owner_id where t.id = '${copy}'`
		)
	).toBe(`Copy me ${token}|true|2`);
	expect(stops(owner)).toBe('1:seed-fort-1,1:seed-temple-1,2:seed-beach-1'); // the original is untouched
	psql(`delete from trips where id in ('${owner}', '${copy}')`);
	await ctx.close();
});

test('uploads: a text file sent as image/webp is refused (SEC-18)', async ({ browser }) => {
	const page = await (await browser.newContext()).newPage();
	await signIn(page, `sniff-${Date.now().toString(36)}@e2e.local`);
	const stay = psql(`select id from stays where slug = 'seed-stay-1'`);
	const res = await page.request.post('/api/booking-proofs', {
		headers: { origin: 'http://localhost:4173' },
		multipart: {
			entity_type: 'stay',
			entity_id: stay,
			file: {
				name: 'proof.webp',
				mimeType: 'image/webp',
				buffer: Buffer.from('<html>not an image</html>')
			}
		}
	});
	expect(res.status()).toBe(400);
	await page.context().close();
});

test('your data: export has my save and trip; delete removes account, rows and files (SEC-15)', async ({
	browser
}) => {
	const email = `del-${Date.now().toString(36)}@e2e.local`;
	const ctx = await browser.newContext();
	const page = await ctx.newPage();
	await signIn(page, email);
	const uid = psql(`select id from auth.users where email = '${email}'`);
	const origin = { origin: 'http://localhost:4173' };
	expect(
		(
			await page.request.post('/api/saved', {
				headers: origin,
				data: { type: 'stay', slug: 'seed-stay-1' }
			})
		).ok()
	).toBe(true);
	psql(`insert into trips (owner_id, title, days) values ('${uid}', 'Delete me trip', 1)`);
	// A booking proof: a real file in the user's storage folder.
	const webp = Buffer.from(
		'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/vuUAAA=',
		'base64'
	);
	const proof = await page.request.post('/api/booking-proofs', {
		headers: origin,
		multipart: {
			entity_type: 'stay',
			entity_id: psql(`select id from stays where slug = 'seed-stay-1'`),
			file: { name: 'p.webp', mimeType: 'image/webp', buffer: webp }
		}
	});
	expect(proof.status(), await proof.text()).toBeLessThan(300);
	const files = () =>
		Number(psql(`select count(*) from storage.objects where name like '${uid}/%'`));
	expect(files()).toBeGreaterThan(0);

	const res = await page.request.get('/api/me/export');
	expect(res.headers()['content-disposition']).toContain('attachment');
	const data = await res.json();
	expect(data.saved).toHaveLength(1);
	expect(data.trips.trips.map((t: { title: string }) => t.title)).toContain('Delete me trip');

	await page.goto('/me');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Delete my account' }).click();
	const forever = page.getByRole('button', { name: 'Delete forever' });
	await expect(forever).toBeDisabled();
	await page.getByTestId('delete-confirm').fill('delete');
	await forever.click();
	await expect(page).toHaveURL('http://localhost:4173/');
	expect(psql(`select count(*) from auth.users where id = '${uid}'`)).toBe('0');
	expect(psql(`select count(*) from trips where owner_id = '${uid}'`)).toBe('0');
	expect(files()).toBe(0);

	// Signing in again with the same address starts an empty account.
	await signIn(page, email);
	const again = await (await page.request.get('/api/me/export')).json();
	expect(again.saved).toEqual([]);
	expect(again.trips.trips).toEqual([]);
	await ctx.close();
});
