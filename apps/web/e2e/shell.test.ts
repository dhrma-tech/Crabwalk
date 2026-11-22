import { expect, test, type Page } from '@playwright/test';
import { gzipSync } from 'node:zlib';

const locales = ['en', 'hi', 'mr'] as const;
const themes = ['light', 'dark'] as const;

async function prefs(page: Page, locale: string, theme?: string) {
	const cookies = [{ name: 'PARAGLIDE_LOCALE', value: locale, url: 'http://localhost:4173' }];
	if (theme) cookies.push({ name: 'theme', value: theme, url: 'http://localhost:4173' });
	await page.context().addCookies(cookies);
}

async function gallery(page: Page) {
	await page.goto('/dev/components');
	await page.evaluate(() => document.fonts.ready);
}

/** Elements whose content is cut off: overflow hidden/clip with scroll size > box, or text outside its checked container. */
function findClipping() {
	const bad: string[] = [];
	const describe = (el: Element) =>
		`${el.tagName.toLowerCase()} "${el.textContent?.trim().slice(0, 40)}"`;
	if (document.documentElement.scrollWidth > innerWidth) bad.push(`page scrolls sideways`);
	for (const root of document.querySelectorAll('[data-clip-check]')) {
		const box = root.getBoundingClientRect();
		for (const el of [root, ...root.querySelectorAll('*')]) {
			const cs = getComputedStyle(el);
			const clips = /hidden|clip/.test(cs.overflowX + cs.overflowY);
			if (clips && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1))
				bad.push(`clipped: ${describe(el)}`);
			if (el.childElementCount === 0 && el.textContent?.trim()) {
				const r = el.getBoundingClientRect();
				if (r.left < box.left - 1 || r.right > box.right + 1)
					bad.push(`overflows: ${describe(el)}`);
			}
		}
	}
	return bad;
}

for (const locale of locales)
	for (const theme of themes)
		test(`gallery snapshot ${locale} ${theme}`, async ({ page }) => {
			await page.setViewportSize({ width: 360, height: 800 });
			await prefs(page, locale, theme);
			await gallery(page);
			await expect(page.locator('html')).toHaveAttribute('lang', locale);
			await expect(page).toHaveScreenshot(`gallery-${locale}-${theme}.png`, { fullPage: true });
		});

for (const width of [360, 640, 1024, 1280])
	test(`no clipping with longest Marathi strings at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await prefs(page, 'mr');
		await gallery(page);
		expect(await page.evaluate(findClipping)).toEqual([]);
	});

test('dark theme tokens apply (manual override and system)', async ({ page }) => {
	await prefs(page, 'en', 'dark');
	await page.goto('/discover');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	// Tideline night tide #0F1215 (DECISIONS T-1).
	expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
		'rgb(15, 18, 21)'
	);

	const sys = await page.context().browser()!.newContext({ colorScheme: 'dark' });
	const p2 = await sys.newPage();
	await p2.goto('http://localhost:4173/');
	expect(await p2.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
		'rgb(15, 18, 21)'
	);
	await sys.close();
});

test('language switch sets lang and persists', async ({ page }) => {
	await page.goto('/me');
	await Promise.all([
		page.waitForResponse((r) => r.url().endsWith('/me') && r.request().method() === 'GET'),
		// The top bar's switch (Me has its own language row too).
		page.getByRole('banner').getByRole('button', { name: 'मराठी' }).click()
	]);
	await expect(page.locator('html')).toHaveAttribute('lang', 'mr');
	await expect(page).toHaveURL(/\/me$/);
	await page.goto('/map');
	await expect(page.locator('html')).toHaveAttribute('lang', 'mr');
});

test('auto-detects language from the phone', async ({ browser }) => {
	const ctx = await browser.newContext({ locale: 'mr-IN' });
	const page = await ctx.newPage();
	await page.goto('http://localhost:4173/');
	await expect(page.locator('html')).toHaveAttribute('lang', 'mr');
	await ctx.close();
});

// Lighthouse 12 dropped its PWA audit; Chrome's own installability check replaces it (DECISIONS P2-2).
// Needs a persistent (non-incognito) profile.
// T1-10 (UX-17): a stable app id and shortcuts to Map, Plan and Crabby.
test('manifest has an id and three shortcuts', async ({ request }) => {
	const man = await (await request.get('/manifest.webmanifest')).json();
	expect(man.id).toBe('/');
	expect(man.shortcuts.map((s: { url: string }) => s.url)).toEqual([
		'/map',
		'/plan/new',
		'/crabby'
	]);
});

test('PWA is installable (Chrome installability check)', async ({ playwright }, info) => {
	const ctx = await playwright.chromium.launchPersistentContext(info.outputPath('profile'), {
		channel: 'chromium'
	});
	const page = await ctx.newPage();
	await page.goto('http://localhost:4173/');
	await page.evaluate(() => navigator.serviceWorker.ready);
	const cdp = await ctx.newCDPSession(page);
	const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
	expect(installabilityErrors).toEqual([]);
	await ctx.close();
});

test('sheet opens from the gallery and snaps on tap', async ({ page }) => {
	await gallery(page);
	await page.waitForLoadState('networkidle'); // hydrated
	await page.getByRole('button', { name: 'Add to my trip plan' }).last().click();
	const handle = page.getByRole('button', { name: 'Drag to resize' });
	await expect(handle).toHaveAttribute('aria-expanded', 'false');
	await handle.click();
	await expect(handle).toHaveAttribute('aria-expanded', 'true');
});

// T1-03 (brief section 4.5): dragging moves the sheet with `transform` only — no Layout per frame. A flick up
// goes to the next snap. The trace is Chromium's own (the DevTools timeline category).
test('sheet drag: no layout per frame; a flick goes to the next snap', async ({
	page,
	browser
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await gallery(page);
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Add to my trip plan' }).last().click();
	const handle = page.getByRole('button', { name: 'Drag to resize' });
	const box = (await handle.boundingBox())!;
	const x = box.x + box.width / 2;
	let y = box.y + box.height / 2;
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x, (y -= 10)); // drag starts (one-time class change)
	await browser.startTracing(page, { categories: ['devtools.timeline'] });
	const frames = 20;
	for (let i = 0; i < frames; i++) {
		await page.mouse.move(x, (y -= 8));
		await page.evaluate(() => new Promise(requestAnimationFrame));
	}
	const trace = JSON.parse((await browser.stopTracing()).toString()) as {
		traceEvents: { name: string }[];
	};
	const layouts = trace.traceEvents.filter((e) => e.name === 'Layout').length;
	console.log(`sheet drag: ${layouts} Layout events over ${frames} frames`);
	expect(layouts).toBe(0);
	// Fast upward release from peek → half (the next snap), not back to the nearest.
	await page.mouse.move(x, y - 30, { steps: 1 });
	await page.mouse.up();
	await expect(handle).toHaveAttribute('aria-expanded', 'true');
	// Keyboard cycles like a tap: half → full → peek.
	await handle.focus();
	await page.keyboard.press('Enter');
	await page.keyboard.press('Enter');
	await expect(handle).toHaveAttribute('aria-expanded', 'false');
});

// 210 KB (owner, 2026-11-17, hardening D-12): every UI message in three languages loads with the shell.
test('app shell JS < 210 KB gzipped', async ({ page }) => {
	const scripts: Promise<Buffer>[] = [];
	page.on('response', (res) => {
		if (res.request().resourceType() === 'script' || res.url().endsWith('.js'))
			scripts.push(res.body());
	});
	// The app shell (the landing at "/" is a marketing page with its own art and code: DECISIONS LJ-11).
	await page.goto('/discover', { waitUntil: 'networkidle' });
	const total = (await Promise.all(scripts)).reduce((n, b) => n + gzipSync(b).length, 0);
	console.log(`app shell JS: ${(total / 1024).toFixed(1)} KB gzipped (${scripts.length} files)`);
	expect(total).toBeLessThan(210 * 1024);
});

test('works offline after first visit', async ({ page, context }) => {
	await page.goto('/discover');
	await page.evaluate(() => navigator.serviceWorker.ready);
	await page.reload(); // SW now controls the page and caches it
	// The page is cached after the response (cache.put), so wait for control + the cached copy, not a delay.
	await page.waitForFunction(
		async () => !!navigator.serviceWorker.controller && !!(await caches.match(location.href))
	);
	await context.setOffline(true);
	await page.reload();
	await expect(page.locator('main')).toBeVisible();
	await expect(page.getByRole('status').filter({ hasText: /offline/i })).toBeVisible();
	await context.setOffline(false);
});
