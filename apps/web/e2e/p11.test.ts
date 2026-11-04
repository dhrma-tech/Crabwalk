import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { psql, signIn } from './helpers.ts';

// P11 plan workspace (steps B–G). Step B: shell — laptop outline · sections · map; phone map + sheet with an outline chip row.
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

test('expenses: name-only tripmates, equal and custom splits, settle list, estimate vs actual', async () => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto(`/plan/${trip}`);
	await page.waitForLoadState('networkidle');
	const box = page.getByTestId('expenses');
	await expect(box.getByTestId('tripmate')).toHaveCount(1); // the owner
	const owner = (await box.getByTestId('tripmate').innerText()).trim();
	for (const n of ['Ravi', 'Meera']) {
		await box.getByLabel("Tripmate's name").fill(n);
		await box.getByRole('button', { name: 'Add tripmate' }).click();
		await expect(box.getByTestId('tripmate').filter({ hasText: n })).toBeVisible();
	}

	// ₹900 paid by the owner, split equally between all three.
	const form = box.getByTestId('spend-form');
	await form.getByLabel('Amount (₹)').fill('900');
	await form.getByLabel('What for').fill('Lunch');
	await form.getByRole('button', { name: 'Log spend' }).click();
	await expect(box.getByTestId('spend')).toHaveCount(1);
	await expect(box.getByTestId('settle')).toContainText(`Ravi pays ${owner} ₹300`);

	// ₹400 paid by Ravi: custom shares, the form shows what's left until they add up.
	await form.getByLabel('Amount (₹)').fill('400');
	await form.getByLabel('Paid by').selectOption({ label: 'Ravi' });
	await form.getByLabel('Custom amounts').check();
	await form.getByLabel(`${owner}'s share`).fill('100');
	await expect(form.getByTestId('split-left')).toHaveText('₹300 left to split');
	await expect(form.getByRole('button', { name: 'Log spend' })).toBeDisabled();
	await form.getByLabel("Meera's share").fill('300');
	await form.getByRole('button', { name: 'Log spend' }).click();
	await expect(box.getByTestId('spend')).toHaveCount(2);
	// Net: owner +500, Ravi +100, Meera −600.
	const settle = box.getByTestId('settle').getByRole('listitem');
	await expect(settle).toHaveText([`Meera pays ${owner} ₹500`, 'Meera pays Ravi ₹100']);
	await expect(page.getByTestId('spent')).toContainText('Spent so far ₹1,300');
	// A tripmate in a spend can't be removed.
	await expect(box.getByRole('button', { name: 'Remove Meera' })).toBeDisabled();
});

// Step F: an edit link joins as editor, a view link as viewer; edits reach the other browser in under 2 s.
test('co-editing: invite links, live edits both ways, viewer reads only', async ({ browser }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto(`/plan/${trip}`);
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Share' }).click();
	const invites = page.getByTestId('invites');
	await invites.getByRole('button', { name: 'Copy edit link' }).click();
	await invites.getByRole('button', { name: 'Copy view link' }).click();
	await expect(invites.getByRole('button', { name: 'Turn off invite links' })).toBeVisible();
	await page.keyboard.press('Escape');
	const token = (role: string) =>
		psql(
			`select token from trip_invites where trip_id = '${trip}' and role = '${role}' and revoked_at is null`
		);

	const editor = await (await browser.newContext()).newPage();
	await editor.setViewportSize({ width: 1280, height: 800 });
	await signIn(editor, `p11-ed-${run}@e2e.local`);
	await editor.goto(`/plan/join/${token('editor')}`);
	await expect(editor).toHaveURL(new RegExp(`/plan/${trip}$`));
	await editor.waitForLoadState('networkidle');
	await expect(editor.getByTestId('save-status')).toHaveText('Saved');

	const add = async (p: Page, text: string) => {
		const list = p.getByTestId('trip-list').first();
		await list.getByPlaceholder('Note or checklist item').fill(text);
		await list.getByRole('button', { name: 'Add to checklist' }).click();
	};
	await add(page, `Ferry cash ${run}`);
	await expect(
		editor.getByTestId('list-text').filter({ hasText: `Ferry cash ${run}` })
	).toBeVisible({
		timeout: 2000
	});
	await add(editor, `Sunscreen ${run}`);
	await expect(page.getByTestId('list-text').filter({ hasText: `Sunscreen ${run}` })).toBeVisible({
		timeout: 2000
	});

	const viewer = await (await browser.newContext()).newPage();
	await signIn(viewer, `p11-view-${run}@e2e.local`);
	await viewer.goto(`/plan/join/${token('viewer')}`);
	await expect(viewer).toHaveURL(new RegExp(`/plan/${trip}$`));
	await expect(viewer.getByText('View only')).toBeVisible();
	await expect(
		viewer.getByTestId('list-text').filter({ hasText: `Sunscreen ${run}` })
	).toBeVisible();
	await expect(viewer.getByRole('button', { name: 'Add to checklist' })).toHaveCount(0);
	await expect(viewer.getByTestId('save-status')).toHaveCount(0);
	await expect(viewer.getByRole('button', { name: 'Log spend' })).toHaveCount(0);
	// The joined trip shows in the editor's trips.
	await editor.goto('/me');
	await expect(editor.getByText(`P11 ${run}`)).toBeVisible();
	await editor.context().close();
	await viewer.context().close();
});

test('undo / redo and the offline queue', async () => {
	await page.goto(`/plan/${trip}`);
	await page.waitForLoadState('networkidle');
	const status = page.getByTestId('save-status');
	const list = page.getByTestId('trip-list').first();
	const item = (t: string) => page.getByTestId('list-text').filter({ hasText: t });
	await list.getByPlaceholder('Note or checklist item').fill(`Undo me ${run}`);
	await list.getByRole('button', { name: 'Add note' }).click();
	await expect(item(`Undo me ${run}`)).toBeVisible();
	await expect(status).toHaveText('Saved');
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(item(`Undo me ${run}`)).toHaveCount(0);
	await page.getByRole('button', { name: 'Redo' }).click();
	await expect(item(`Undo me ${run}`)).toBeVisible();
	await expect(status).toHaveText('Saved');

	// Offline: the edit waits in the queue, then lands when the connection returns.
	await page.context().setOffline(true);
	await list.getByPlaceholder('Note or checklist item').fill(`Offline ${run}`);
	await list.getByRole('button', { name: 'Add note' }).click();
	await expect(status).toHaveText('Offline — will sync');
	await page.context().setOffline(false);
	await expect(status).toHaveText('Saved');
	await expect(item(`Offline ${run}`)).toBeVisible();
	expect(psql(`select count(*) from trip_list_items where body = 'Offline ${run}'`)).toBe('1');
});

// Step G: WCAG 2.2 AA on the filled workspace (lists, spends, balances, invites), light + dark, EN + MR, laptop + phone.
test('a11y: workspace and share sheet pass axe', async () => {
	const problems: string[] = [];
	const audit = async (where: string) => {
		const r = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
			.exclude('.maplibregl-canvas')
			.analyze();
		problems.push(
			...r.violations.map(
				(v) =>
					`${where}: ${v.id} (${v.impact}): ${v.nodes
						.map((n) => n.target.join(' '))
						.slice(0, 3)
						.join(' | ')}`
			)
		);
	};
	for (const [w, h] of [
		[1280, 800],
		[390, 844]
	] as const)
		for (const scheme of ['light', 'dark'] as const)
			for (const locale of ['en', 'mr'] as const) {
				await page.setViewportSize({ width: w, height: h });
				await page.emulateMedia({ colorScheme: scheme });
				await page
					.context()
					.addCookies([{ name: 'PARAGLIDE_LOCALE', value: locale, url: 'http://localhost:4173' }]);
				await page.goto(`/plan/${trip}`);
				await page.waitForLoadState('networkidle');
				const where = `${w} ${scheme} ${locale}`;
				await audit(where);
				await page.locator('main header [aria-haspopup="dialog"]').click(); // Share, in any language
				await expect(page.getByTestId('invites')).toBeVisible();
				await audit(`${where} share sheet`);
				await page.keyboard.press('Escape');
			}
	await page
		.context()
		.addCookies([{ name: 'PARAGLIDE_LOCALE', value: 'en', url: 'http://localhost:4173' }]);
	await page.emulateMedia({ colorScheme: 'light' });
	expect(problems, problems.join('\n')).toEqual([]);
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
