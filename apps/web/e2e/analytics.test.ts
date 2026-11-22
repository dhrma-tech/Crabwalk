import { expect, test } from '@playwright/test';
import { psql } from './helpers.ts';

// Hardening T1-11 (UX-05): first-party events. A page view is stored; no user id, IP, email or free text;
// Do Not Track sends nothing, and the server ignores a DNT request too.
test.skip(process.env.E2E_SUPABASE !== 'local', 'needs E2E_SUPABASE=local');

const count = (where: string) =>
	Number(psql(`select count(*) from analytics_events where ${where}`));

test('a page view is stored with a route id, a day hash and nothing identifying', async ({
	page
}) => {
	const before = count(`name = 'page_view' and route = '/terms'`);
	await page.goto('/terms');
	await expect.poll(() => count(`name = 'page_view' and route = '/terms'`)).toBeGreaterThan(before);
	const row = psql(
		`select session_hash ~ '^[0-9a-f]{64}$', lang, props from analytics_events where name = 'page_view' and route = '/terms' order by id desc limit 1`
	);
	expect(row).toBe('t|en|{}');

	// A search stores counts, never the words typed.
	const words = `zzqx${Date.now().toString(36)}`;
	await page.goto('/discover');
	await page.waitForLoadState('networkidle');
	await page.getByRole('searchbox').first().fill(words);
	await expect
		.poll(() => count(`name = 'search' and (props ? 'results') and (props ? 'zero')`))
		.toBeGreaterThan(0);
	expect(count(`props::text ilike '%${words}%' or route ilike '%${words}%'`)).toBe(0);
});

test('Do Not Track: the browser sends no event and the server stores none', async ({ browser }) => {
	const ctx = await browser.newContext({ extraHTTPHeaders: { DNT: '1' } });
	await ctx.addInitScript(() =>
		Object.defineProperty(Navigator.prototype, 'doNotTrack', { get: () => '1' })
	);
	const page = await ctx.newPage();
	const sent: string[] = [];
	page.on('request', (r) => {
		if (new URL(r.url()).pathname === '/api/e') sent.push(r.url());
	});
	await page.goto('/privacy');
	await page.waitForLoadState('networkidle');
	await page.goto('/terms');
	await page.waitForLoadState('networkidle');
	expect(sent).toEqual([]);
	const probe = `dnt${Date.now().toString(36)}`;
	const r = await page.request.post('/api/e', {
		data: { name: 'lang_switch', props: { to: probe } }
	});
	expect(r.status()).toBe(204);
	await page.waitForTimeout(500);
	expect(count(`props->>'to' = '${probe}'`)).toBe(0);
	await ctx.close();
});

test('the endpoint refuses unknown names, free text and big bodies', async ({ request }) => {
	expect((await request.post('/api/e', { data: { name: 'evil' } })).status()).toBe(400);
	expect(
		(
			await request.post('/api/e', { data: { name: 'search', props: { q: 'x'.repeat(200) } } })
		).status()
	).toBe(400);
	expect(
		(
			await request.post('/api/e', {
				headers: { 'content-type': 'application/json' },
				data: 'x'.repeat(3000)
			})
		).status()
	).toBe(413);
});
