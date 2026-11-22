import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Landing + onboarding (docs/crabwalk-handoff/PLAN.md). Static content only: no local stack needed.
const SECTIONS = [
	'Discover Ratnagiri',
	'Eleven ways into the coast',
	'The quiet side of Ratnagiri',
	'One place for the whole trip. Built here, checked here.',
	'Say hello to your Konkan local',
	'Tell it your trip. Get a plan with reasons.',
	'Rated by travellers, in one honest word',
	'Start your Konkan trip'
];

test.describe('landing', () => {
	test.use({ reducedMotion: 'reduce' });

	test('sections in the reference order, real text, no console errors', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (e) => errors.push(e.message));
		page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
		await page.goto('/');
		await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('Ratnagiri');
		const h2 = (await page.locator('main h2').allInnerTexts()).map((s) =>
			s.replace(/\s+/g, ' ').trim()
		);
		expect(h2).toEqual(SECTIONS);
		await expect(
			page.getByRole('img', { name: 'Coastal route from Jaigad to Pawas' })
		).toBeAttached();
		await page.waitForLoadState('networkidle');
		expect(errors).toEqual([]);
	});

	test('interactions: taluka, gems, offline demo, planner tabs, verdict groups', async ({
		page
	}) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		await page
			.getByRole('group', { name: 'Choose a taluka' })
			.getByRole('button', { name: 'Dapoli' })
			.click();
		await expect(page.locator('.card h3')).toHaveText('Dapoli');

		await page.getByRole('button', { name: 'Next place' }).click();
		await expect(page.getByText('02 / 06')).toBeVisible();

		const sw = page.getByRole('switch', { name: 'Turn off network' });
		await sw.click();
		await expect(sw).toHaveAttribute('aria-checked', 'true');
		await expect(page.getByText('No network', { exact: true })).toBeVisible();

		await page.getByRole('tab', { name: 'D2' }).click();
		await expect(page.getByText('Day 2 · North coast')).toBeVisible();

		await page.getByRole('tab', { name: 'Couple' }).click();
		await expect(page.getByRole('tab', { name: 'Couple' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(page.getByText('[%] of [n] couple votes')).toBeVisible();
	});

	test('Discover moved to /discover', async ({ page }) => {
		const res = await page.goto('/discover');
		expect(res?.status()).toBeLessThan(500);
	});

	for (const path of ['/', '/onboarding']) {
		test(`axe: no serious or critical issues on ${path}`, async ({ page }) => {
			await page.goto(path);
			await page.waitForLoadState('networkidle');
			const axe = await new AxeBuilder({ page })
				.withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
				.analyze();
			const bad = axe.violations
				.filter((v) => v.impact === 'serious' || v.impact === 'critical')
				.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
			expect(bad).toEqual([]);
		});
	}
});

test.describe('onboarding', () => {
	test('guest path, choices persist across a reload, postcard flips', async ({ page }) => {
		await page.goto('/onboarding');
		await page.waitForLoadState('networkidle');
		await page.evaluate(() => localStorage.removeItem('cw_onboarding'));
		await page.getByRole('button', { name: /Explore without an account/ }).click();
		await page.getByLabel('Your name').fill('Asha');
		await page.reload();
		await page.waitForLoadState('networkidle');
		await expect(page.getByLabel('Your name')).toHaveValue('Asha');

		// The language card re-renders the step in that script at once.
		await page.getByRole('radio', { name: /मराठी/ }).check({ force: true });
		await expect(page.getByRole('heading', { level: 1 })).toContainText('क्रॅबी');
		await page.getByRole('radio', { name: /English/ }).check({ force: true });

		await page.getByRole('button', { name: /Continue/ }).click();
		await page.getByRole('radio', { name: /Family/ }).check({ force: true });
		await page.getByRole('button', { name: /Continue/ }).click();
		const cont = page.getByRole('button', { name: /Continue/ });
		await expect(cont).toBeDisabled();
		for (const n of ['Beaches', 'Sea forts', 'Temples'])
			await page.getByRole('checkbox', { name: n }).check({ force: true });
		await expect(cont).toBeEnabled();
		await cont.click();
		await page.getByRole('button', { name: 'Start exploring' }).click();
		await expect(page.getByRole('heading', { name: 'Your Konkan is ready, Asha' })).toBeVisible();
		await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
	});
});

test('Crabby character sheet shows every state', async ({ page }) => {
	await page.goto('/crabby/sheet');
	for (const s of ['idle', 'wave', 'scuttle', 'point', 'think', 'celebrate', 'sleep'])
		await expect(page.locator('figcaption code', { hasText: new RegExp(`^${s}$`) })).toBeVisible();
	await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
});
