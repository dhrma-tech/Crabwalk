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
	// Only the sections column scrolls: the page itself fits the viewport.
	expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(800);

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

type E2EMap = {
	isMoving(): boolean;
	getCenter(): { lng: number; lat: number };
	project(at: [number, number]): { x: number; y: number };
	queryRenderedFeatures(o: { layers: string[] }): {
		properties: { id: string };
		geometry: { coordinates: [number, number] };
	}[];
};
/** The day's rendered stop pin (once the camera has settled): its stop id, map point and screen pixel. */
const renderedStop = () =>
	page
		.waitForFunction(() => {
			const m = (window as unknown as { __map?: E2EMap }).__map;
			const f = m && !m.isMoving() && m.queryRenderedFeatures({ layers: ['stop'] })[0];
			if (!f) return null;
			const at = f.geometry.coordinates;
			return { id: f.properties.id, at, px: m.project(at) };
		})
		.then((h) => h.jsonValue());

test('1280 px: a stop pans the map to its pin; a pin picks its stop', async () => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto(`/plan/${trip}`);
	await page.waitForLoadState('networkidle');
	const day1 = await renderedStop();

	await page.getByRole('button', { name: 'Stop 1 on the map' }).locator('visible=true').click();
	await expect(page.locator(`#stop-${day1.id}`)).toHaveAttribute('data-active', 'true');
	await page.waitForFunction(([lon, lat]) => {
		const m = (window as unknown as { __map: E2EMap }).__map;
		const c = m.getCenter();
		return !m.isMoving() && Math.abs(c.lng - lon) < 1e-3 && Math.abs(c.lat - lat) < 1e-3;
	}, day1.at);

	// Day 2's pin → its stop is picked, unfolded and scrolled into view.
	await page.getByRole('tab', { name: /Day 2/ }).click();
	await section('Itinerary').click(); // fold it: the pin must unfold it again
	const day2 = await renderedStop();
	expect(day2.id).not.toBe(day1.id);
	const box = (await page.locator('.maplibregl-canvas').boundingBox())!;
	await page.mouse.click(box.x + day2.px.x, box.y + day2.px.y);
	const stop = page.locator(`#stop-${day2.id}`);
	await expect(stop).toHaveAttribute('data-active', 'true');
	await expect(stop).toBeInViewport();
});

test('lists: add a place → drag into Day 2 → it shows on the map; move to day, checklist, notes', async () => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto(`/plan/${trip}`);
	await page.waitForLoadState('networkidle');
	const list = page.getByTestId('trip-list').first();
	await expect(list).toContainText('Nothing here yet');

	// Add a place from search (starts the default list).
	await list.getByPlaceholder('Add place').fill('Seed Beach');
	await list.getByTestId('list-hits').getByRole('button', { name: 'Seed Beach 1' }).click();
	const beach = page.getByTestId('list-place').filter({ hasText: 'Seed Beach 1' });
	await expect(beach).toBeVisible();

	// Drag it into Day 2's timeline.
	await page.getByRole('tab', { name: /Day 2/ }).click();
	const day2 = page.getByTestId('plan-day').nth(1);
	const target = day2.getByTestId('plan-stop').first();
	// A tall laptop screen with Overview folded: the list place and Day 2 fit on one screen, no auto-scroll.
	await page.setViewportSize({ width: 1280, height: 1000 });
	await section('Overview').click();
	await beach.evaluate((el) => el.scrollIntoView({ block: 'start' }));
	await expect(target).toBeInViewport();
	const from = (await beach.boundingBox())!;
	await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
	await page.mouse.down();
	await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 10, { steps: 4 });
	const to = (await target.boundingBox())!;
	await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 });
	await page.waitForTimeout(400); // dnd-action looks for the zone under the card every ~150 ms
	await page.mouse.up();
	await expect(day2.getByTestId('plan-stop').filter({ hasText: 'Seed Beach 1' })).toBeVisible({
		timeout: 15_000
	});
	await expect(beach).toHaveCount(0);
	// Day 2's map now has both stops.
	await page.waitForFunction(() => {
		const m = (window as unknown as { __map?: E2EMap }).__map;
		return m && !m.isMoving() && m.queryRenderedFeatures({ layers: ['stop'] }).length === 2;
	});

	// Recommended "+" → list; "Move to day…" sends it to Day 1.
	const rec = list.getByTestId('recommended');
	const pick = rec.getByRole('button', { name: /^Add / }).first();
	const name = (await pick.getAttribute('aria-label'))!.slice(4);
	await pick.click();
	const viewpoint = page.getByTestId('list-place').filter({ hasText: name });
	await expect(viewpoint).toBeVisible();
	await list.getByRole('button', { name: 'Show list on the map' }).click();
	await page.waitForFunction(() => {
		const m = (window as unknown as { __map?: E2EMap }).__map;
		const f = m && !m.isMoving() && m.queryRenderedFeatures({ layers: ['stop'] });
		return f && f.length === 1;
	});
	await viewpoint.getByLabel('Move to day…').selectOption('1');
	await expect(viewpoint).toHaveCount(0);
	await page.getByRole('tab', { name: /Day 1/ }).click();
	await expect(
		page.getByTestId('plan-day').first().getByTestId('plan-stop').filter({ hasText: name })
	).toBeVisible();

	// Checklist item + trip notes survive a reload.
	await list.getByPlaceholder('Note or checklist item').fill('Carry cash for the ferry');
	await list.getByRole('button', { name: 'Add to checklist' }).click();
	const check = page.getByRole('checkbox', { name: 'Done: Carry cash for the ferry' });
	await check.check();
	await page.getByLabel('Trip notes').fill('Ferry leaves at 7');
	await page.getByLabel('Trip notes').blur();
	await expect(page.getByText('Updating times…')).toHaveCount(0); // save queue drained
	await page.waitForLoadState('networkidle');
	await page.reload();
	await expect(
		page.getByRole('checkbox', { name: 'Done: Carry cash for the ferry' })
	).toBeChecked();
	await expect(page.getByLabel('Trip notes')).toHaveValue('Ferry leaves at 7');
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

	// A stop's number shows its pin in the map strip above the sheet.
	await page.getByRole('button', { name: 'Stop 1 on the map' }).locator('visible=true').click();
	await expect(handle).toHaveAttribute('aria-expanded', 'true'); // half
	await page.waitForTimeout(500); // camera ease
	const pin = await renderedStop();
	const top = (await handle.boundingBox())!.y;
	expect(pin.px.y).toBeGreaterThan(0);
	expect(pin.px.y + 56).toBeLessThan(top); // + the top bar above the map canvas
});
