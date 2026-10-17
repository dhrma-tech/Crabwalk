import { expect, test } from '@playwright/test';
import { psql, signIn, userWithRole } from './helpers.ts';

// P4 acceptance on the local stack (E2E_SUPABASE=local): field form → review → published; price sources.
const local = process.env.E2E_SUPABASE === 'local';
test.skip(!local, 'needs E2E_SUPABASE=local');
test.describe.configure({ mode: 'serial', timeout: 90_000 });

const run = Date.now().toString(36);

const name = `E2E Cove ${run}`;

test('verifier creates a place in the field; it appears after reviewer approval', async ({
	browser
}) => {
	// Verifier: field form (GPS denied in tests → coordinates typed, as the form allows).
	const v = await userWithRole(browser, `verifier-${run}@e2e.local`, 'verifier');
	await v.page.goto('/admin/field');
	await v.page.waitForLoadState('networkidle'); // hydrated: the form submits via the offline queue
	const form = v.page.getByTestId('field-form');
	await form.locator('input[name="name_en"]').fill(name);
	await form.locator('input[name="name_mr"]').fill(`ई२ई किनारा ${run}`);
	await form.locator('input[name="lat"]').fill('16.9950');
	await form.locator('input[name="lon"]').fill('73.2900');
	await form.locator('select[name="taluka_id"]').selectOption({ label: 'Ratnagiri' });
	await form.locator('select[name="category"]').selectOption('beach');
	await form.locator('input[name="fee"]').fill('Free');
	await form.locator('input[type="file"]').setInputFiles('static/icons/icon-512.png');
	await expect(form.locator('img')).toHaveCount(1); // resized to WebP in the browser
	await form.locator('textarea[name="notes"]').fill('Quiet cove, steps down from the road.');
	await form.getByRole('button', { name: 'Submit for review' }).click();
	await expect(v.page.getByText('Sent for review')).toBeVisible();
	expect(
		psql(
			`select status from places p join place_translations t on t.place_id = p.id where t.name = '${name}'`
		)
	).toBe('in_review');

	// Not public yet.
	const slug = psql(
		`select slug from places p join place_translations t on t.place_id = p.id where t.name = '${name}'`
	);
	const anon = await browser.newContext();
	const a = await anon.newPage();
	expect((await a.goto(`/place/${slug}`))!.status()).toBe(404);

	// Verifiers cannot publish (API).
	const id = psql(`select id from places where slug = '${slug}'`);
	expect(
		(
			await v.page.request.post(`/api/admin/drafts/${id}/approve`, { data: { type: 'place' } })
		).status()
	).toBe(403);

	// Reviewer: writes the story, approves and publishes.
	const r = await userWithRole(browser, `reviewer-${run}@e2e.local`, 'reviewer');
	await r.page.goto('/admin/review');
	await r.page.waitForLoadState('networkidle');
	await r.page.getByTestId('review-queue').getByRole('link', { name }).click();
	await r.page.locator('textarea[name="en.short_story"]').fill('A quiet cove south of town.');
	await r.page.getByRole('button', { name: 'Approve and publish' }).click();
	await expect(r.page.getByText('Published', { exact: true })).toBeVisible();

	// Public now: place page + Discover category grid.
	await a.goto(`/place/${slug}`);
	await expect(a.getByRole('heading', { name, level: 2 })).toBeVisible();
	await expect(a.getByText('A quiet cove south of town.')).toBeVisible();
	await expect(a.getByText(/^Verified \d/)).toBeVisible();
	await a.goto('/?category=beach');
	await expect(a.getByRole('link', { name: new RegExp(name) })).toBeVisible();
	await Promise.all([v.ctx.close(), r.ctx.close(), anon.close()]);
});

test('field form queues offline and sends when back online', async ({ browser }) => {
	const v = await userWithRole(browser, `verifier3-${run}@e2e.local`, 'verifier');
	await v.page.goto('/admin/field');
	await v.page.waitForLoadState('networkidle');
	const form = v.page.getByTestId('field-form');
	const offlineName = `E2E Offline ${run}`;
	await form.locator('input[name="name_en"]').fill(offlineName);
	await form.locator('input[name="lat"]').fill('16.9800');
	await form.locator('input[name="lon"]').fill('73.3000');
	await form.locator('select[name="taluka_id"]').selectOption({ label: 'Ratnagiri' });
	await v.ctx.setOffline(true);
	await form.getByRole('button', { name: 'Submit for review' }).click();
	await expect(v.page.getByText('Saved offline', { exact: false }).first()).toBeVisible();
	expect(psql(`select count(*) from place_translations where name = '${offlineName}'`)).toBe('0');
	await v.ctx.setOffline(false);
	await expect
		.poll(() => psql(`select count(*) from place_translations where name = '${offlineName}'`), {
			timeout: 15_000
		})
		.toBe('1');
	await v.ctx.close();
});

test('stay price table shows a source label on every row', async ({ page }) => {
	const slug = `e2e-stay-${run}`;
	psql(
		`with s as (insert into stays (slug, taluka_id, location, price_min, price_max, price_source, phone, status)
		   values ('${slug}', (select id from talukas where name_en = 'Ratnagiri'), 'SRID=4326;POINT(73.30 16.99)', 1800, 2500, 'owner', '+919800000000', 'published') returning id),
		 t as (insert into stay_translations (stay_id, lang, name) select id, 'en', 'E2E Homestay' from s)
		 insert into stay_offers (stay_id, provider, deep_link, affiliate_network)
		 select id, 'makemytrip', 'https://example.com/mmt', 'inrdeals' from s union all
		 select id, 'booking_com', 'https://example.com/bcom', 'cuelinks' from s`
	);
	await page.goto(`/stays/${slug}`);
	const rows = page.getByTestId('price-table').locator('tr');
	await expect(rows).toHaveCount(3);
	const sources = await page.getByTestId('price-source').allTextContents();
	expect(sources).toEqual(['Source: owner', 'Source: INRDeals', 'Source: Cuelinks']);
	await expect(page.getByRole('link', { name: 'Call' })).toHaveAttribute(
		'href',
		'tel:+919800000000'
	);
});

test('anyone can report a problem; verifier sees it in triage', async ({ page, browser }) => {
	const slug = psql(
		`select slug from places where status = 'published' and is_seed order by slug limit 1`
	);
	await page.goto(`/place/${slug}`);
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Report a problem' }).click();
	await page.getByLabel('What’s wrong?').fill(`Steps broken ${run}`);
	await page.getByRole('button', { name: 'Send report' }).click();
	await expect(page.getByText('Thanks — a verifier will check this.')).toBeVisible();

	const v = await userWithRole(browser, `verifier2-${run}@e2e.local`, 'verifier');
	await v.page.goto('/admin/reports');
	await expect(
		v.page.getByTestId('report').filter({ hasText: `Steps broken ${run}` })
	).toBeVisible();
	await v.ctx.close();
});

test('owner claims a stay, admin approves, owner edits facts only', async ({ browser }) => {
	const slug = `e2e-own-${run}`;
	const stayId = psql(
		`with s as (insert into stays (slug, taluka_id, location, price_min, price_max, phone, status)
		   values ('${slug}', (select id from talukas where name_en = 'Ratnagiri'), 'SRID=4326;POINT(73.31 16.99)', 1000, 1500, '+919811111111', 'published') returning id)
		 insert into stay_translations (stay_id, lang, name) select id, 'en', 'E2E Owner Stay' from s returning stay_id`
	);
	const o = await browser.newContext();
	const op = await o.newPage();
	const ownerEmail = `owner-${run}@e2e.local`;
	await signIn(op, ownerEmail);
	await op.goto(`/stays/${slug}`);
	await op.getByRole('link', { name: 'Own this place? Claim it' }).click();
	await op.getByRole('button', { name: 'Send claim' }).click();
	await expect(op.getByText('Claim sent.', { exact: false })).toBeVisible();

	const admin = await browser.newContext();
	const ap = await admin.newPage();
	await signIn(ap, `admin-${run}@e2e.local`);
	psql(
		`insert into user_roles (user_id, role) select id, 'admin' from auth.users where email = 'admin-${run}@e2e.local'`
	);
	await ap.goto('/admin/claims');
	await ap
		.locator('article', { hasText: ownerEmail })
		.getByRole('button', { name: 'Approve' })
		.click();
	await expect(ap.locator('article', { hasText: ownerEmail })).toHaveCount(0);

	await op.goto(`/owner/stay/${stayId}`);
	await op.waitForLoadState('networkidle');
	await op.locator('input[name="price_min"]').fill('1200');
	await op.locator('input[name="price_max"]').fill('1800');
	await op.getByRole('button', { name: 'Save changes' }).click();
	await expect(op.getByText('Saved', { exact: true })).toBeVisible();
	expect(
		psql(
			`select price_min || '-' || price_max || ' ' || price_source from stays where id = '${stayId}'`
		)
	).toBe('1200-1800 owner');

	// Non-fact edits are refused even through the owner API.
	const bad = await op.request.patch(`/api/owner/listing/${stayId}`, {
		data: { type: 'stay', price_min: 1, price_max: 2, phone: '', whatsapp: '', is_verified: true }
	});
	expect(psql(`select is_verified from stays where id = '${stayId}'`)).toBe('f');
	expect(bad.status()).toBeLessThan(500);
	await Promise.all([o.close(), admin.close()]);
});
