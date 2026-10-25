import { expect, test } from '@playwright/test';
import { psql, signIn, userWithRole } from './helpers.ts';

// P5 acceptance (local stack): gauge winner/%/count per group type; "New" below 10; hygiene/cleanliness
// server-enforced for unverified users; booking proof unlocks it; reviews go through moderation.
test.skip(process.env.E2E_SUPABASE !== 'local', 'needs E2E_SUPABASE=local');
test.describe.configure({ mode: 'serial', timeout: 90_000 });

const run = Date.now().toString(36);
const T = `(select id from talukas where name_en = 'Ratnagiri')`;

/** Published listing + N synthetic voters with the given levels for one group type. */
function seed(
	kind: 'place' | 'eatery' | 'stay',
	slug: string,
	votes: Partial<Record<string, number[]>>
) {
	const table = { place: 'places', eatery: 'eateries', stay: 'stays' }[kind];
	const extra = kind === 'place' ? ', category' : '';
	const extraVal = kind === 'place' ? ", 'fort'" : '';
	const id = psql(
		`insert into ${table} (slug, taluka_id, location, status${extra}) values ('${slug}', ${T}, 'SRID=4326;POINT(73.3 16.99)', 'published'${extraVal}) returning id`
	);
	psql(
		`insert into ${kind}_translations (${kind}_id, lang, name) values ('${id}', 'en', 'E2E ${kind} ${run}')`
	);
	for (const [group, levels] of Object.entries(votes))
		levels!.forEach((level, i) => {
			const uid = psql(
				`insert into auth.users (id, email) values (gen_random_uuid(), 'v-${slug}-${group}-${i}@e2e.local') returning id`
			);
			psql(
				`insert into verdicts (user_id, entity_type, entity_id, group_type, level) values ('${uid}', '${kind}', '${id}', '${group}', ${level})`
			);
		});
	return id;
}

test('gauge shows winner, % and count per group type; New below 10 votes', async ({ page }) => {
	const slug = `e2e-gauge-${run}`;
	// family: 12 votes → 4×7, 3×3, 2×2 → "Must visit" 58% · 12 votes.  couple: 3 votes → New.
	seed('place', slug, { family: [4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 2, 2], couple: [1, 2, 2] });
	await page.goto(`/place/${slug}`);
	await page.waitForLoadState('networkidle');
	const g = page.getByTestId('verdict-gauge');

	// All = 15 votes → winner Must visit (7/15 = 47%).
	await expect(g.getByTestId('gauge-winner')).toHaveText('Must visit');
	await expect(g.getByTestId('gauge-pct')).toContainText('47%');
	await expect(g.getByTestId('gauge-count')).toHaveText('15 votes');

	await g.getByRole('radio', { name: 'Family' }).click();
	await expect(g.getByTestId('gauge-winner')).toHaveText('Must visit');
	await expect(g.getByTestId('gauge-pct')).toContainText('58%');
	await expect(g.getByTestId('gauge-count')).toHaveText('12 votes');

	await g.getByRole('radio', { name: 'Couple' }).click();
	await expect(g.getByText('New', { exact: true })).toBeVisible();
	await expect(g.getByTestId('gauge-count')).toHaveText('3 votes');
	await expect(g.getByTestId('gauge-winner')).toHaveCount(0);

	await g.getByRole('radio', { name: 'Solo' }).click();
	await expect(g.getByText('No votes yet. Be the first.')).toBeVisible();
});

test('signed-in vote updates the gauge; unverified hygiene refused server-side; proof unlocks it', async ({
	browser
}) => {
	const slug = `e2e-eat-${run}`;
	const id = seed('eatery', slug, {});
	const email = `voter-${run}@e2e.local`;
	const ctx = await browser.newContext();
	const page = await ctx.newPage();
	await signIn(page, email);
	await page.goto(`/food/${slug}`);
	await page.waitForLoadState('networkidle');

	const vote = page.getByTestId('verdict-vote');
	await vote.getByRole('radio', { name: 'Solo' }).click();
	await vote.getByRole('button', { name: 'Local legend' }).click();
	await expect(page.getByTestId('verdict-gauge').getByTestId('gauge-count')).toHaveText('1 votes');
	await expect(page.getByTestId('verdict-gauge').getByText('New', { exact: true })).toBeVisible();
	await expect(vote.getByRole('button', { name: 'Local legend' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	// UI: hygiene taps disabled with explanation; taste works.
	await expect(vote.getByTestId('tap-hygiene').getByRole('radio').first()).toBeDisabled();
	await expect(vote.getByTestId('tap-hygiene')).toContainText('Verified visitors only');
	await vote.getByTestId('tap-taste').getByRole('radio', { name: 'Taste: 4 of 5' }).click();
	await expect(
		vote.getByTestId('tap-taste').getByRole('radio', { name: 'Taste: 4 of 5' })
	).toHaveAttribute('aria-checked', 'true');

	// Server: hygiene from an unverified user → 403 (not just hidden in the UI).
	const denied = await page.request.post('/api/subscores', {
		data: { entity_type: 'eatery', entity_id: id, scores: { hygiene: 5 } }
	});
	expect(denied.status()).toBe(403);
	expect(
		psql(`select count(*) from sub_scores where entity_id = '${id}' and dimension = 'hygiene'`)
	).toBe('0');

	// Booking proof → verifier approves → hygiene allowed for this user and eatery.
	await vote
		.locator('input[type="file"][accept^="image/jpeg"]')
		.setInputFiles('static/icons/icon-192.png');
	await vote.getByRole('button', { name: 'Upload', exact: true }).click();
	await expect(vote.getByText('Uploaded — a verifier will check it.')).toBeVisible();

	const v = await userWithRole(browser, `proofv-${run}@e2e.local`, 'verifier');
	await v.page.goto('/admin/proofs');
	const card = v.page.getByTestId('pending-proof').filter({ hasText: `E2E eatery ${run}` });
	await expect(card.locator('img')).toBeVisible();
	await card.getByRole('button', { name: 'Approve' }).click();
	await expect(card).toHaveCount(0);
	expect(
		psql(
			`select count(*) from booking_proofs where entity_id = '${id}' and status = 'approved' and storage_path is null`
		)
	).toBe('1');
	expect(
		psql(
			`select count(*) from storage.objects where bucket_id = 'booking-proofs' and name like '%' || (select id from auth.users where email = '${email}') || '%'`
		)
	).toBe('0');

	const ok = await page.request.post('/api/subscores', {
		data: { entity_type: 'eatery', entity_id: id, scores: { hygiene: 5 } }
	});
	expect(ok.status()).toBe(200);
	await page.reload();
	await expect(page.getByTestId('sub-scores')).toContainText('Hygiene');
	await Promise.all([ctx.close(), v.ctx.close()]);
});

test('review is moderated before it appears', async ({ browser }) => {
	const slug = `e2e-stay-${run}`;
	seed('stay', slug, {});
	const ctx = await browser.newContext();
	const page = await ctx.newPage();
	await signIn(page, `reviewer-user-${run}@e2e.local`);
	await page.goto(`/stays/${slug}`);
	await page.waitForLoadState('networkidle');
	const text = `Lovely host, quiet nights ${run}`;
	await page.getByLabel('Add a few words (optional)').fill(text);
	await page
		.getByTestId('verdict-vote')
		.locator('input[type="file"][accept="image/*"]')
		.setInputFiles('static/icons/icon-512.png');
	await expect(page.getByText('1/4')).toBeVisible();
	await page.getByRole('button', { name: 'Post review' }).click();
	await expect(page.getByText('Thanks — your review appears after a quick check.')).toBeVisible();

	const anon = await browser.newContext();
	const a = await anon.newPage();
	await a.goto(`/stays/${slug}`);
	await expect(a.getByTestId('reviews')).not.toContainText(text);

	const r = await userWithRole(browser, `mod-${run}@e2e.local`, 'reviewer');
	await r.page.goto('/admin/moderation');
	await r.page
		.getByTestId('pending-review')
		.filter({ hasText: text })
		.getByRole('button', { name: 'Approve' })
		.click();
	await expect(r.page.getByTestId('pending-review').filter({ hasText: text })).toHaveCount(0);

	await a.reload();
	await expect(a.getByTestId('reviews')).toContainText(text);
	await expect(a.getByTestId('reviews').locator('img')).toHaveAttribute(
		'src',
		/\/review-photos\/.+-480\.webp$/
	);
	await Promise.all([ctx.close(), anon.close(), r.ctx.close()]);
});
