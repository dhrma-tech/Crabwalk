import { expect, test } from '@playwright/test';

// Hardening T1-10 (UX-02): an empty filtered list names its filters; each chip drops one, "Clear all" drops all.
test.skip(process.env.E2E_SUPABASE !== 'local', 'needs E2E_SUPABASE=local');

for (const [list, query, drop, keep] of [
	['/stays', 'vibe=pet_friendly&max_price=1', 'Pet-friendly', 'max_price=1'],
	['/food', 'diet=jain&max_price=1', 'Jain', 'max_price=1']
] as const)
	test(`${list}: no results → one chip per filter, each drops only itself`, async ({ page }) => {
		await page.goto(`${list}?${query}`);
		const empty = page.getByTestId('empty-filters');
		const chips = empty.getByRole('listitem');
		await expect(chips).toHaveCount(2);
		await expect(empty).toContainText(drop);
		await expect(empty).toContainText('₹1');
		await chips.filter({ hasText: drop }).getByRole('link').click();
		await expect(page).toHaveURL((u) => u.pathname === list && u.search === `?${keep}`);
		await page.goto(`${list}?${query}`);
		await page
			.getByTestId('empty-filters')
			.getByRole('link', { name: 'Clear all filters' })
			.click();
		await expect(page).toHaveURL((u) => u.pathname === list && !u.search);
	});
