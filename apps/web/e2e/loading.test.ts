import { expect, test } from '@playwright/test';

// Hardening T1-04 (brief section 4.4): one transform-only band per skeleton group; images that are already
// loaded never start hidden; a slow navigation shows the route progress line.
test.skip(process.env.E2E_SUPABASE !== 'local', 'needs E2E_SUPABASE=local (seed stays)');

test('skeleton: one transform animation per group, none on the blocks', async ({ page }) => {
	await page.goto('/dev/components');
	const groups = await page.evaluate(() =>
		[...document.querySelectorAll('.skg')].map((el) =>
			el.getAnimations({ subtree: true }).map((a) => {
				const e = a.effect as KeyframeEffect;
				const props = e
					.getKeyframes()
					.flatMap((k) =>
						Object.keys(k).filter(
							(p) => !['offset', 'easing', 'composite', 'computedOffset'].includes(p)
						)
					);
				return `${e.target === el ? '' : 'child'}${e.pseudoElement ?? ''}:${[...new Set(props)]}`;
			})
		)
	);
	expect(groups.length).toBeGreaterThanOrEqual(3);
	for (const g of groups) expect(g).toEqual(['::after:transform']);
});

// The gallery's photo card uses a bundled category image (the seed has no listing photos).
test('a photo still loading fades in; once cached it does not flash on the way back', async ({
	page
}) => {
	await page.addInitScript(() => {
		const w = window as unknown as { hidden: string[] };
		w.hidden = [];
		new MutationObserver((ms) => {
			for (const m of ms) {
				const i = m.target as HTMLImageElement;
				if (i.tagName === 'IMG' && i.style.opacity === '0')
					w.hidden.push(i.getAttribute('src') ?? '');
			}
		}).observe(document, { subtree: true, attributes: true, attributeFilter: ['style'] });
	});
	const hidden = () => page.evaluate(() => (window as unknown as { hidden: string[] }).hidden);
	const photo = '/categories/beach.webp';
	// The photo is held until hydration has hidden it, so it is still loading when the card mounts.
	let release = () => {};
	const held = new Promise<void>((f) => (release = f));
	await page.route(`**${photo}`, async (r) => {
		await held;
		await r.continue();
	});
	await page.goto('/dev/components', { waitUntil: 'domcontentloaded' });
	const img = page.locator(`img[src="${photo}"]`);
	await expect.poll(hidden, { timeout: 20_000 }).toEqual([photo]); // not loaded at mount: transparent
	release();
	await expect
		.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth))
		.toBeTruthy();
	await expect(img).toHaveCSS('opacity', '1');

	await page.evaluate(() => ((window as unknown as { hidden: string[] }).hidden = []));
	await page.getByRole('link', { name: 'Crabwalk' }).first().click();
	await expect(page).toHaveURL(/\/$/);
	await page.goBack();
	await expect(img).toBeVisible();
	await expect(img).toHaveCSS('opacity', '1');
	expect(await hidden()).toEqual([]);
});

test('a navigation over 150 ms shows the progress line until the page is in', async ({ page }) => {
	await page.goto('/stays');
	await page.waitForLoadState('networkidle');
	await page.route('**/__data.json*', async (r) => {
		await new Promise((f) => setTimeout(f, 800));
		await r.continue();
	});
	const line = page.locator('.rp');
	await expect(line).toHaveCSS('opacity', '0');
	await page.locator('a:has([data-vt-photo])').first().click();
	await expect(line).toHaveClass(/\brun\b/);
	await expect(line).toHaveCSS('opacity', '1');
	await expect(page).toHaveURL(/\/stays\/[^/]+$/);
	await expect(line).not.toHaveClass(/\b(run|done)\b/);
	await expect(line).toHaveCSS('opacity', '0');
});
