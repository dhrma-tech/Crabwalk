import { expect, test } from '@playwright/test';
import { psql, signIn } from './helpers.ts';

// Saved (DECISIONS T-5 / T-46): heart on every card, optimistic; guest → sign in with ?next; Me "Saved";
// /api/saved is private and never cached.
test.skip(process.env.E2E_SUPABASE !== 'local', 'needs E2E_SUPABASE=local');

const run = Date.now().toString(36);
const card = (page: import('@playwright/test').Page, name: string) =>
	page.locator('article', { has: page.getByRole('heading', { name, exact: true }) });

test('guest: the heart goes to sign in with ?next; the API refuses', async ({ page }) => {
	const r = await page.request.get('/api/saved');
	expect(r.status()).toBe(401);
	await page.goto('/stays');
	await page.waitForLoadState('networkidle'); // hydrated: the heart is a JS button
	await card(page, 'Seed Stay 1').getByRole('button', { name: 'Save' }).click();
	await expect(page).toHaveURL(/\/login\?next=%2Fstays$/);
});

test('signed in: save, see it in Me, keep it after reload, unsave', async ({ page }) => {
	const email = `saver-${run}@e2e.local`;
	await signIn(page, email);
	const rows = () =>
		psql(
			`select count(*) from saved_items i join auth.users u on u.id = i.user_id where u.email = '${email}'`
		);

	await page.goto('/stays');
	await page.waitForLoadState('networkidle'); // hydrated: the heart is a JS button
	const heart = card(page, 'Seed Stay 1').getByRole('button', { name: /^Save/ });
	await expect(heart).toHaveAttribute('aria-pressed', 'false');
	await heart.click();
	await expect(heart).toHaveAttribute('aria-pressed', 'true');
	await expect.poll(rows).toBe('1');

	const api = await page.request.get('/api/saved');
	expect(api.headers()['cache-control']).toBe('private, no-store');
	expect(await api.json()).toEqual([{ type: 'stay', slug: 'seed-stay-1' }]);

	await page.reload();
	await expect(card(page, 'Seed Stay 1').getByRole('button', { name: 'Saved' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	await page.goto('/me');
	const saved = page.getByTestId('my-saved');
	await expect(saved.getByRole('link', { name: /Seed Stay 1/ })).toHaveAttribute(
		'href',
		'/stays/seed-stay-1'
	);

	await page.goto('/stays');
	await page.waitForLoadState('networkidle'); // hydrated: the heart is a JS button
	await card(page, 'Seed Stay 1').getByRole('button', { name: 'Saved' }).click();
	await expect(card(page, 'Seed Stay 1').getByRole('button', { name: 'Save' })).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	await expect.poll(rows).toBe('0');
	await page.goto('/me');
	await expect(page.getByTestId('my-saved')).toContainText('Nothing saved yet');
});
