import { expect, test } from '@playwright/test';

// Hardening T1-01 (brief section 4.2): under reduced motion nothing keeps moving once a page has loaded.
// Only time-driven animations count: scroll-linked ones (the row scroll indicator) move only while the person
// scrolls, like a scrollbar (IMPLEMENTATION_LOG D-27).
test.skip(process.env.E2E_SUPABASE !== 'local', 'needs E2E_SUPABASE=local (seed place)');
test.use({ reducedMotion: 'reduce' });

for (const path of ['/', '/place/seed-fort-1', '/map']) {
	test(`reduced motion: no running animations after load on ${path}`, async ({ page }) => {
		await page.goto(path);
		await page.waitForLoadState('networkidle');
		await expect
			.poll(() =>
				page.evaluate(() =>
					document
						.getAnimations()
						.filter((a) => a.playState === 'running' && a.timeline === document.timeline)
						.map((a) => (a as CSSAnimation).animationName ?? a.id)
				)
			)
			.toEqual([]);
	});
}
