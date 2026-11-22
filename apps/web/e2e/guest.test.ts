import { expect, test } from '@playwright/test';
import { psql } from './helpers.ts';

// Temp access gate (AUTH_MODE=temp_email_gate) after hardening 2026-11 (SEC-02): page views create no account;
// the browser creates the guest session on the first action that needs one. Runs against the second preview
// server (playwright.config.ts, port 4175).
test.skip(process.env.E2E_SUPABASE !== 'local', 'needs E2E_SUPABASE=local');
test.use({ baseURL: 'http://localhost:4175' });
// One at a time: the first test counts anonymous users, and the others create them.
test.describe.configure({ mode: 'serial' });

const authCookies = async (page: import('@playwright/test').Page) =>
	(await page.context().cookies()).filter((c) => c.name.includes('-auth-token'));
const card = (page: import('@playwright/test').Page, name: string) =>
	page.locator('article', { has: page.getByRole('heading', { name, exact: true }) });

test('a cookieless page view sets no Supabase auth cookie and creates no user', async ({
	page
}) => {
	const before = psql('select count(*) from auth.users where is_anonymous');
	await page.goto('/discover');
	await page.waitForLoadState('networkidle');
	await page.goto('/stays');
	await page.waitForLoadState('networkidle');
	expect(await authCookies(page)).toEqual([]);
	expect(psql('select count(*) from auth.users where is_anonymous')).toBe(before);
	expect((await page.request.get('/api/saved')).status()).toBe(401);
});

test('first heart tap on a fresh profile ends with the item saved', async ({ page }) => {
	await page.goto('/stays');
	await page.waitForLoadState('networkidle'); // hydrated: the heart is a JS button
	const heart = card(page, 'Seed Stay 1').getByRole('button', { name: /^Save/ });
	await heart.click();
	await expect(heart).toHaveAttribute('aria-pressed', 'true');
	expect((await authCookies(page)).length).toBeGreaterThan(0);
	// SEC-10: the session is httpOnly; scripts only see the companion flag.
	for (const c of await authCookies(page)) expect(c.httpOnly, c.name).toBe(true);
	expect((await page.context().cookies()).find((c) => c.name === 'cw_signed_in')?.value).toBe('1');
	expect(await page.evaluate(() => document.cookie)).not.toContain('-auth-token');
	await expect(page).toHaveURL(/\/stays$/); // no sign-in detour
	// The heart turns on optimistically; the save lands a moment later.
	await expect
		.poll(async () => (await page.request.get('/api/saved')).json())
		.toEqual([{ type: 'stay', slug: 'seed-stay-1' }]);
});

test('a page that needs a session goes through /guest and comes back', async ({ page }) => {
	await page.goto('/plan/new');
	// /plan/new → /guest?next=/plan/new → guest session → /plan/new → the new trip's workspace.
	await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}$/, { timeout: 30_000 });
	expect((await authCookies(page)).length).toBeGreaterThan(0);
});

test('"Continue as guest" unlocks the vote in place; /guest rejects off-site next', async ({
	page
}) => {
	await page.goto('/place/seed-fort-1');
	await page.waitForLoadState('networkidle');
	const vote = page.getByTestId('verdict-vote');
	await vote.getByTestId('guest-continue').click();
	await expect(vote.getByTestId('guest-continue')).toHaveCount(0);
	await expect(page).toHaveURL(/\/place\/seed-fort-1$/);
	// SEC-03: a guest vote is stored but not counted, and the page says so.
	await expect(vote.getByTestId('vote-guest-note')).toBeVisible();
	const uncounted = () =>
		psql(
			`select count(*) from verdicts v join auth.users u on u.id = v.user_id where u.is_anonymous and not v.counted`
		);
	const before = Number(uncounted());
	// T1-05: no remembered traveller group yet, so the group comes first.
	await vote.getByRole('radio', { name: 'Solo' }).click();
	await vote.getByRole('button', { name: 'Must visit' }).click();
	await expect.poll(() => Number(uncounted())).toBe(before + 1);
	// SEC-15: Me tells a guest where their things live.
	await page.goto('/me');
	await expect(page.getByTestId('guest-notice')).toBeVisible();
	// Already signed in: /guest just forwards, and only to a same-origin path.
	await page.goto('/guest?next=//evil.example/x');
	await expect(page).toHaveURL('http://localhost:4175/');
});

test('admin gate: wrong passcode counts towards the global lock; right one signs in for 24 h; exit clears it (SEC-08)', async ({
	page
}) => {
	const fails = () =>
		Number(psql(`select coalesce(sum(fails), 0) from gate_attempts where key = repeat('0', 64)`));
	// Start the global counter fresh: a row left by an earlier run restarts at 1 once its hour has passed,
	// which made `before + 1` depend on the clock. Only this test fails the gate.
	psql(`delete from gate_attempts where key = repeat('0', 64)`);
	const before = fails();
	const events = () =>
		Number(psql(`select count(*) from security_events where kind = 'admin_gate_fail'`));
	const eventsBefore = events();
	const bad = await page.request.post('/auth/admin', {
		data: { email: 'e2e-admin@e2e.local', passcode: 'wrong-passcode' }
	});
	expect(await bad.json()).toEqual({ admin: false });
	expect(fails()).toBe(before + 1);
	// SEC-16: one security event, with a hash of the email and nothing readable.
	expect(events()).toBe(eventsBefore + 1);
	const row = psql(
		`select row_to_json(e)::text from security_events e where kind = 'admin_gate_fail' order by id desc limit 1`
	);
	expect(row).toMatch(/"email_sha256": ?"[0-9a-f]{64}"/);
	expect(row).not.toMatch(/@|e2e-admin|wrong-passcode/);

	const ok = await page.request.post('/auth/admin', {
		data: { email: 'E2E-Admin@e2e.local ', passcode: 'e2e-only-passcode-1234' }
	});
	expect(await ok.json()).toMatchObject({ admin: true });
	const cookie = (await page.context().cookies()).find((c) => c.name === 'cw_admin');
	expect(cookie?.httpOnly).toBe(true);
	// 24 hours (± a minute for the round trip).
	expect(Math.abs(cookie!.expires - (Date.now() / 1000 + 86400))).toBeLessThan(60);
	await page.goto('/admin/content');
	await expect(page).toHaveURL(/\/admin\/content/);

	// SEC-16: an editor save leaves one audit row with the changed keys only and a hashed editor.
	const place = psql(`select id from places where slug = 'seed-fort-1'`);
	const audits = () =>
		Number(psql(`select count(*) from admin_audit where entity_id = '${place}'`));
	const auditsBefore = audits();
	const entry = await (await page.request.get(`/api/admin/content/place/${place}`)).json();
	const saved = await page.request.put(`/api/admin/content/place/${place}`, {
		headers: { origin: 'http://localhost:4175' },
		data: {
			version: entry.version,
			changes: { how_to_reach_text: `Bus from the stand ${Date.now()}` }
		}
	});
	expect(saved.status(), await saved.text()).toBe(200);
	expect(audits()).toBe(auditsBefore + 1);
	const audit = psql(
		`select row_to_json(a)::text from admin_audit a where entity_id = '${place}' order by id desc limit 1`
	);
	expect(audit).toContain('how_to_reach_text');
	expect(audit).not.toMatch(/@|Bus from the stand/);
	await page.goto('/admin/security');
	await expect(page.getByTestId('security-events')).toContainText('admin_gate_fail');

	// Same-origin, like the Exit admin button (SvelteKit refuses cross-site DELETEs).
	const exit = await page.request.delete('/auth/admin', {
		headers: { origin: 'http://localhost:4175' }
	});
	expect(exit.status(), await exit.text()).toBe(200);
	expect((await page.context().cookies()).find((c) => c.name === 'cw_admin')).toBeUndefined();
});
