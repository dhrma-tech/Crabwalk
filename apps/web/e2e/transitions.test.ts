import { expect, test, type Page } from '@playwright/test';

// Hardening T1-02 (brief section 4.3): the tapped card's photo morphs into the detail hero; back reverses it;
// reduced motion → no transition. Records, for each view transition, `data-nav` and which element holds the
// `hero` name in the old and the new state (exactly one each).
test.skip(process.env.E2E_SUPABASE !== 'local', 'needs E2E_SUPABASE=local (seed stays)');

async function record(page: Page) {
	await page.evaluate(() => {
		const w = window as unknown as { vt: { nav?: string; old: string[]; new?: string[] }[] };
		w.vt = [];
		const heroes = () =>
			[...document.querySelectorAll<HTMLElement>('[data-vt-photo], [data-vt-hero]')]
				.filter((e) => getComputedStyle(e).viewTransitionName === 'hero')
				.map((e) => (e.hasAttribute('data-vt-hero') ? 'hero' : 'card'));
		const start = document.startViewTransition.bind(document);
		document.startViewTransition = ((cb: () => Promise<void>) => {
			const entry: (typeof w.vt)[number] = {
				nav: document.documentElement.dataset.nav,
				old: heroes()
			};
			w.vt.push(entry);
			return start(async () => {
				await cb();
				entry.new = heroes();
			});
		}) as typeof document.startViewTransition;
	});
}
const log = (page: Page) => page.evaluate(() => (window as unknown as { vt: unknown[] }).vt);

test('card photo morphs into the hero; back reverses', async ({ page }) => {
	await page.goto('/stays');
	await page.waitForLoadState('networkidle');
	await record(page);
	await page.locator('a:has([data-vt-photo])').first().click();
	await expect(page).toHaveURL(/\/stays\/[^/]+$/);
	await expect.poll(() => log(page)).toEqual([{ nav: 'forward', old: ['card'], new: ['hero'] }]);

	await page.goBack();
	await expect(page).toHaveURL(/\/stays$/);
	await expect
		.poll(() => log(page))
		.toEqual([
			{ nav: 'forward', old: ['card'], new: ['hero'] },
			{ nav: 'back', old: ['hero'], new: ['card'] }
		]);
	// The name is only held for the transition.
	await expect
		.poll(() => page.locator('[data-vt-photo][style*="view-transition-name"]').count())
		.toBe(0);
});

for (const path of ['/discover', '/place/seed-fort-1'])
	test(`no layout shift while ${path} loads (CLS 0, phone)`, async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(path);
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(1000); // the hero settle (delay + 480 ms) has run
		// The observer only fires when there are entries, so collect for a moment, then read the sum.
		const cls = await page.evaluate(
			() =>
				new Promise<number>((done) => {
					let sum = 0;
					new PerformanceObserver((list) => {
						for (const e of list.getEntries())
							sum += (e as PerformanceEntry & { value: number }).value;
					}).observe({ type: 'layout-shift', buffered: true });
					setTimeout(() => done(sum), 300);
				})
		);
		expect(cls).toBe(0);
	});

test.describe('reduced motion', () => {
	test.use({ reducedMotion: 'reduce' });
	test('no view transition', async ({ page }) => {
		await page.goto('/stays');
		await page.waitForLoadState('networkidle');
		await record(page);
		await page.locator('a:has([data-vt-photo])').first().click();
		await expect(page).toHaveURL(/\/stays\/[^/]+$/);
		expect(await log(page)).toEqual([]);
	});
});
