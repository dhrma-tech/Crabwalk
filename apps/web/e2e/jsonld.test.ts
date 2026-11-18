import { expect, test } from '@playwright/test';

// Hardening T1-12 (UX-09): detail pages carry valid schema.org JSON-LD (CSP: p10 checks zero violations here).
test.skip(process.env.E2E_SUPABASE !== 'local', 'needs E2E_SUPABASE=local');

test('a place page has TouristAttraction JSON-LD with name, geo and url', async ({ page }) => {
	await page.goto('/place/seed-fort-1');
	const text = await page.locator('script[type="application/ld+json"]').textContent();
	const ld = JSON.parse(text ?? '');
	expect(ld['@context']).toBe('https://schema.org');
	expect(ld['@type']).toBe('TouristAttraction');
	expect(ld.name).toBeTruthy();
	expect(ld.url).toMatch(/\/place\/seed-fort-1$/);
	expect(ld.geo).toMatchObject({ '@type': 'GeoCoordinates' });
	expect(typeof ld.geo.latitude).toBe('number');
	if (ld.aggregateRating) expect(ld.aggregateRating.ratingCount).toBeGreaterThanOrEqual(10);
});
