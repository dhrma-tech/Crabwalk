import { expect, test, type Page } from '@playwright/test';
import { psql, signIn } from './helpers.ts';

// P11 step B: plan workspace shell — laptop outline · sections · map; phone map + sheet with an outline chip row.
test.skip(process.env.E2E_SUPABASE !== 'local', 'needs E2E_SUPABASE=local');
test.describe.configure({ mode: 'serial', timeout: 120_000 });

const run = Date.now();
let page: Page;
let trip = '';

test.beforeAll(async ({ browser }) => {
	page = await (await browser.newContext()).newPage();
	const email = `p11-${run}@e2e.local`;
	await signIn(page, email);
	trip = psql(
		`insert into trips (owner_id, title, days, start_point, status) select id, 'P11 ${run}', 2, jsonb_build_object('label','Start','lon',73.279,'lat',16.999), 'saved' from auth.users where email = '${email}' returning id`
	);
	psql(
		`insert into trip_stops (trip_id, day, "order", entity_type, entity_id, kind)
		 select '${trip}', v.d, 0, 'place', p.id, 'place'
		 from (values ('seed-fort-1', 1), ('seed-temple-1', 2)) v(slug, d) join places p on p.slug = v.slug`
	);
});

const section = (name: string) => page.getByRole('button', { name, exact: true });

test('1280 px: outline rail, folding sections, map beside them', async () => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto(`/plan/${trip}`);
	await page.waitForLoadState('networkidle');
	const rail = page.getByRole('navigation', { name: 'Trip outline' }).locator('visible=true');
	await expect(rail).toHaveCount(1);
	await expect(rail.getByRole('link', { name: 'Day 2' })).toBeVisible();
	await expect(page.getByRole('region', { name: 'Trip map' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Drag to resize' })).toBeHidden();

	// Map and sections sit side by side.
	const map = (await page.getByRole('region', { name: 'Trip map' }).boundingBox())!;
	const body = (await page.locator('#itinerary').boundingBox())!;
	expect(map.x).toBeGreaterThanOrEqual(body.x + body.width - 1);

	await section('Itinerary').click();
	await expect(section('Itinerary')).toHaveAttribute('aria-expanded', 'false');
	await expect(page.getByTestId('plan-stop').first()).toBeHidden();

	await page.getByRole('button', { name: 'Expand all' }).click();
	await expect(section('Itinerary')).toHaveAttribute('aria-expanded', 'true');
	await page.getByRole('button', { name: 'Collapse all' }).click();
	await expect(section('Overview')).toHaveAttribute('aria-expanded', 'false');
	await expect(section('Itinerary')).toHaveAttribute('aria-expanded', 'false');

	// Picking a day unfolds the itinerary on that day.
	await rail.getByRole('link', { name: 'Day 2' }).click();
	await expect(section('Itinerary')).toHaveAttribute('aria-expanded', 'true');
	await expect(page.getByTestId('plan-stop').locator('visible=true').first()).toBeVisible();
	await expect(page.getByRole('tab', { name: /Day 2/ })).toHaveAttribute('aria-selected', 'true');
});

test('390 px: map on top, sections in a sheet, outline chips', async () => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(`/plan/${trip}`);
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('region', { name: 'Trip map' })).toBeVisible();
	const handle = page.getByRole('button', { name: 'Drag to resize' });
	await expect(handle).toBeVisible();
	const chips = page.getByRole('navigation', { name: 'Trip outline' }).locator('visible=true');
	await expect(chips).toHaveCount(1);
	await expect(chips.getByRole('link', { name: 'Day 1' })).toHaveCount(0);

	await section('Itinerary').click();
	await expect(section('Itinerary')).toHaveAttribute('aria-expanded', 'false');
	await chips.getByRole('link', { name: 'Itinerary' }).click();
	await expect(section('Itinerary')).toHaveAttribute('aria-expanded', 'true');
	await expect(handle).toHaveAttribute('aria-expanded', 'true');
	await expect(page.getByTestId('plan-stop').locator('visible=true').first()).toBeInViewport();

	const width = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(width).toBeLessThanOrEqual(390);
});
