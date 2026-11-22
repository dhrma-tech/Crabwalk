import { expect, test } from '@playwright/test';

// Hardening T1-06 (brief section 4.7): the heart pops on save only; the phone nav's dot slides to the new tab.
// Hit areas are covered by the existing touch-target checks (shell, p10).
test.skip(process.env.E2E_SUPABASE !== 'local', 'needs E2E_SUPABASE=local');

test('heart pops on save, not on unsave', async ({ page }) => {
	await page.goto('/dev/components');
	await page.waitForLoadState('networkidle');
	// The gallery's PlaceCard keeps its saved state locally (the other sample cards ignore the tap).
	const card = page.locator('section.grid > article').first();
	const heart = card.getByRole('button', { name: 'Save', exact: true });
	const pops = () =>
		page.evaluate(
			() =>
				document
					.getAnimations()
					.filter((a) =>
						(a.effect as KeyframeEffect)
							.getKeyframes()
							.some((k) => String(k.transform).includes('1.3'))
					).length
		);
	await heart.click();
	const saved = card.getByRole('button', { name: 'Saved', exact: true });
	await expect(saved).toHaveAttribute('aria-pressed', 'true');
	expect(await pops()).toBe(1);
	await expect.poll(pops).toBe(0); // the pop (480 ms) is over
	await saved.click();
	await expect(heart).toHaveAttribute('aria-pressed', 'false');
	expect(await pops()).toBe(0);
});

test('phone nav: one dot slides to the new tab', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/discover');
	await page.waitForLoadState('networkidle');
	const dot = page.locator('[data-nav-dot]');
	const x = () => dot.evaluate((d) => new DOMMatrix(getComputedStyle(d).transform).m41);
	const width = await dot.evaluate((d) => d.getBoundingClientRect().width);
	expect(await x()).toBe(0);
	await dot.evaluate((d) => {
		const w = window as unknown as { ran: string[] };
		w.ran = [];
		d.addEventListener('transitionrun', (e) => w.ran.push(e.propertyName));
	});
	await page
		.getByRole('navigation', { name: 'Main' })
		.last()
		.getByRole('link', { name: 'Me' })
		.click();
	await expect(page).toHaveURL(/\/me$/);
	await expect.poll(x).toBeCloseTo(width * 4, 0);
	expect(await page.evaluate(() => (window as unknown as { ran: string[] }).ran)).toContain(
		'transform'
	);
});
