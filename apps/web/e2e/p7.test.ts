import { expect, test, type Page } from '@playwright/test';
import { psql, signIn } from './helpers.ts';

// P7 acceptance (local stack): no stop outside opening hours or tide cut-off; Google Maps links ≤ 10
// stops; guest voting without login; reorder re-times; publish → review → public itinerary.
test.skip(process.env.E2E_SUPABASE !== 'local', 'needs E2E_SUPABASE=local');
test.describe.configure({ mode: 'serial', timeout: 120_000 });

const run = Date.now().toString(36);
const T = `(select id from talukas where name_en = 'Ratnagiri')`;
const LON = 73.45;
const LAT = 17.2;
const H = (s: string) => {
	const [h, m] = s.split(':').map(Number);
	return h! * 60 + m!;
};

function place(
	name: string,
	dx: number,
	hours: [string | null, string | null] | 'none',
	tide = false
) {
	const id = psql(
		`insert into places (slug, category, taluka_id, location, status, is_tide_dependent, visit_minutes)
		 values ('e2e-p7-${name}-${run}', 'orchard', ${T}, 'SRID=4326;POINT(${LON + dx} ${LAT})', 'published', ${tide}, 60)
		 returning id`
	);
	psql(
		`insert into place_translations (place_id, lang, name) values ('${id}', 'en', 'P7 ${name} ${run}')`
	);
	if (hours !== 'none')
		psql(
			`insert into place_hours (place_id, weekday, opens, closes)
			 select '${id}', d, ${hours[0] ? `'${hours[0]}'` : 'null'}, ${hours[1] ? `'${hours[1]}'` : 'null'} from generate_series(0, 6) d`
		);
	return id;
}

let owner: Page;
let tripId = '';

test.beforeAll(() => {
	// Earlier runs' fixtures sit at the same spot and would compete with this run's.
	psql(`delete from places where slug like 'e2e-p7-%'`);
	psql(`delete from eateries where slug like 'e2e-p7-%'`);
	psql(`delete from stays where slug like 'e2e-p7-%'`);
	psql(`delete from utility_pois where name like 'P7 Station %'`);
	place('morning', 0, ['09:00', '11:00']);
	place('afternoon', 0.01, ['15:00', '18:00']);
	place('tide', 0.005, ['07:00', '18:00'], true); // tide-dependent, no rule → never planned (P7-4)
	place('closed', 0.008, [null, null]); // closed every day
	place('nohours', 0.012, 'none'); // daylight only, "Hours not confirmed" (P7-3)
	const eat = psql(
		`insert into eateries (slug, taluka_id, location, status, price_for_two) values ('e2e-p7-eat-${run}', ${T}, 'SRID=4326;POINT(${LON + 0.004} ${LAT})', 'published', 400) returning id`
	);
	psql(
		`insert into eatery_translations (eatery_id, lang, name) values ('${eat}', 'en', 'P7 Eatery ${run}')`
	);
	const stay = psql(
		`insert into stays (slug, taluka_id, location, status, price_min) values ('e2e-p7-stay-${run}', ${T}, 'SRID=4326;POINT(${LON + 0.006} ${LAT})', 'published', 2000) returning id`
	);
	psql(
		`insert into stay_translations (stay_id, lang, name) values ('${stay}', 'en', 'P7 Stay ${run}')`
	);
	psql(
		`insert into utility_pois (type, location, name, source, taluka_id) values ('railway_station', 'SRID=4326;POINT(${LON - 0.01} ${LAT})', 'P7 Station ${run}', 'osm', ${T})`
	);
});

test('signed out: planner asks to sign in', async ({ page }) => {
	await page.goto('/plan/new');
	await expect(page.getByText('Sign in to plan, save and share trips.')).toBeVisible();
});

test('generate: no stop outside hours or tide cut-off; meals, stay, budget, Maps ≤ 10', async ({
	browser
}) => {
	const ctx = await browser.newContext();
	owner = await ctx.newPage();
	await signIn(owner, `p7-${run}@e2e.local`);
	await owner.goto('/plan/new');
	await owner.waitForLoadState('networkidle'); // hydrated: chip clicks register
	// One question per step (T-31): days → start → group → budget → interests → pace → Standout.
	const next = () => owner.getByRole('button', { name: 'Next' }).click();
	await next();
	await owner.getByLabel('Railway station or bus stand').fill(`P7 Station ${run}`);
	await next();
	await next();
	await next();
	await owner.getByRole('button', { name: 'Orchard' }).click();
	await next();
	await next();
	await owner.getByRole('button', { name: 'Generate plan' }).click();
	await owner.waitForURL(/\/plan\/[0-9a-f-]{36}$/);
	tripId = owner.url().split('/').at(-1)!;

	const day1 = owner.getByTestId('plan-day').first();
	const stops = day1.getByTestId('plan-stop');
	await expect(stops.first()).toBeVisible();
	const rows = await stops.evaluateAll((els) =>
		els.map((e) => ({
			kind: e.getAttribute('data-kind'),
			text: e.textContent ?? '',
			time: e.querySelector('[data-testid="stop-time"]')?.textContent ?? ''
		}))
	);
	const range = (t: string) =>
		t
			.match(/(\d\d:\d\d)–(\d\d:\d\d)/)!
			.slice(1)
			.map(H);
	const morning = rows.find((r) => r.text.includes(`P7 morning ${run}`));
	const afternoon = rows.find((r) => r.text.includes(`P7 afternoon ${run}`));
	expect(morning, JSON.stringify(rows)).toBeDefined();
	expect(afternoon, JSON.stringify(rows)).toBeDefined();
	const [ma, md] = range(morning!.time);
	expect(ma).toBeGreaterThanOrEqual(H('09:00'));
	expect(md).toBeLessThanOrEqual(H('11:00'));
	const [aa, ad] = range(afternoon!.time);
	expect(aa).toBeGreaterThanOrEqual(H('15:00'));
	expect(ad).toBeLessThanOrEqual(H('18:00'));
	const all = await owner.getByTestId('plan-stop').allTextContents();
	expect(all.some((t) => t.includes(`P7 tide ${run}`))).toBe(false);
	expect(all.some((t) => t.includes(`P7 closed ${run}`))).toBe(false);
	const nohours = rows.find((r) => r.text.includes(`P7 nohours ${run}`));
	if (nohours) {
		expect(nohours.text).toContain('Hours not confirmed');
		const [na, nd] = range(nohours.time);
		expect(na).toBeGreaterThanOrEqual(H('07:00'));
		expect(nd).toBeLessThanOrEqual(H('18:30'));
	}
	expect(rows.some((r) => r.kind === 'meal')).toBe(true);
	expect(rows.at(-1)!.kind).toBe('stay');

	// Budget: stay ₹2,000 + meals; fuel not invented (no admin price set).
	const budget = owner.getByTestId('budget');
	await expect(budget).toContainText('₹2,000');
	await expect(budget).toContainText('Enter fuel price');

	// Google Maps: every link ≤ 10 points.
	const links = await owner
		.getByTestId('gmaps')
		.first()
		.locator('a')
		.evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
	expect(links.length).toBeGreaterThan(0);
	for (const l of links) {
		const wp = new URL(l).searchParams.get('waypoints')?.split('|').length ?? 0;
		expect(wp + 2).toBeLessThanOrEqual(10);
	}
	const api = await owner.request.get(`/api/trips/${tripId}/gmaps`);
	expect(api.ok()).toBe(true);
});

test('reorder re-times and flags a stop moved outside its hours', async () => {
	const first = owner.getByTestId('plan-day').first().getByTestId('plan-stop').first();
	await expect(first).toContainText(`P7 morning ${run}`);
	// Move the 09:00–11:00 stop below lunch: it can no longer fit its hours.
	await first.getByRole('button', { name: 'Move down' }).click();
	await expect(
		owner.getByTestId('plan-stop').filter({ hasText: `P7 morning ${run}` })
	).toContainText('May be closed at this time');
});

test('guest votes without login; owner sees the tally', async ({ browser }) => {
	const token = psql(`select share_token from trips where id = '${tripId}'`);
	const guest = await (await browser.newContext()).newPage();
	await guest.goto(`/plan/vote/${token}`);
	await guest.getByLabel('Your name').fill('Asha');
	const spot = guest.getByTestId('vote-spot').filter({ hasText: `P7 afternoon ${run}` });
	await spot.getByText('Yes', { exact: true }).click();
	await guest.getByRole('button', { name: 'Send votes' }).click();
	await expect(guest.getByText('Thanks! Your votes are in.')).toBeVisible();
	await expect(spot).toContainText('1 yes');

	await guest.goto(`/plan/share/${token}`);
	await expect(guest.getByTestId('plan-stop').first()).toBeVisible();

	await owner.reload();
	await expect(owner.getByTestId('voters')).toHaveText('1 people voted');
	await expect(
		owner
			.getByTestId('plan-stop')
			.filter({ hasText: `P7 afternoon ${run}` })
			.getByTestId('stop-votes')
	).toBeVisible();
});

test('publish → reviewer approves → public itinerary another user can plan from', async ({
	browser
}) => {
	await owner.getByRole('button', { name: 'Submit for review' }).click();
	await expect(owner.getByTestId('publish-status')).toHaveText('Waiting for review');

	const rctx = await browser.newContext();
	const reviewer = await rctx.newPage();
	const remail = `p7-rev-${run}@e2e.local`;
	await signIn(reviewer, remail);
	psql(
		`insert into user_roles (user_id, role) select id, 'reviewer' from auth.users where email = '${remail}'`
	);
	await reviewer.goto('/admin/routes');
	const card = reviewer.getByTestId('route-review').filter({ hasText: `P7 morning ${run}` });
	await card.getByRole('button', { name: 'Publish' }).click();
	await expect(card).toHaveCount(0);

	const anon = await (await browser.newContext()).newPage();
	await anon.goto(`/itineraries/${tripId}`);
	await expect(anon.getByTestId('plan-stop').first()).toBeVisible();
	await expect(anon.getByRole('link', { name: 'Sign in to plan this trip' })).toBeVisible();

	await reviewer.goto(`/itineraries/${tripId}`);
	await reviewer.getByRole('button', { name: 'Plan this trip' }).click();
	await reviewer.waitForURL(/\/plan\/[0-9a-f-]{36}$/);
	expect(reviewer.url()).not.toContain(tripId);
	await expect(reviewer.getByTestId('plan-stop').first()).toBeVisible();
});
