import { expect, test, type Page } from '@playwright/test';
import { psql, signIn } from './helpers.ts';

// P8 acceptance (local stack, AI_PROVIDER=mock): login wall; emergency bypass with zero AI calls; answers
// only from tools; no phone numbers / coordinates in any LLM payload (log-inspected); "don't know" path;
// preview → Apply; 21st message refused; review pre-screen; content drafting; similar places; privacy.
test.skip(process.env.E2E_SUPABASE !== 'local', 'needs E2E_SUPABASE=local');
test.describe.configure({ mode: 'serial', timeout: 120_000 });

const run = Date.now().toString(36);
const T = `(select id from talukas where name_en = 'Ratnagiri')`;
const email = `p8-${run}@e2e.local`;
let page: Page;

async function say(text: string) {
	await page.getByLabel('Ask Crabby…').fill(text);
	await page.getByRole('button', { name: 'Send' }).click();
}
const lastAnswer = () => page.getByTestId('bubble-crabby').last();

test.beforeAll(() => {
	psql(`delete from places where slug like 'e2e-p8-%'`);
	psql(`delete from stays where slug like 'e2e-p8-%'`);
	psql(`delete from utility_pois where name like 'P8 Station %'`);
	const id = psql(
		`insert into places (slug, category, taluka_id, location, status) values ('e2e-p8-cave-${run}', 'cave', ${T}, 'SRID=4326;POINT(73.6 17.4)', 'published') returning id`
	);
	psql(
		`insert into place_translations (place_id, lang, name) values ('${id}', 'en', 'P8 Cave ${run}')`
	);
	// A stay with contact details: they must never reach the model.
	const stay = psql(
		`insert into stays (slug, taluka_id, location, status, price_min, phone, whatsapp) values ('e2e-p8-stay-${run}', ${T}, 'SRID=4326;POINT(73.601 17.4)', 'published', 1800, '9822012345', '9822054321') returning id`
	);
	psql(
		`insert into stay_translations (stay_id, lang, name) values ('${stay}', 'en', 'P8 Stay ${run}')`
	);
	psql(
		`insert into utility_pois (type, location, name, source, taluka_id) values ('railway_station', 'SRID=4326;POINT(73.59 17.4)', 'P8 Station ${run}', 'osm', ${T})`
	);
});

test('login wall for chat', async ({ page: anon }) => {
	await anon.goto('/crabby');
	await anon.waitForLoadState('networkidle');
	await anon.getByLabel('Ask Crabby…').fill('show me a cave');
	await anon.getByRole('button', { name: 'Send' }).click();
	await expect(anon.getByTestId('crabby-signin')).toBeVisible();
});

test('emergency keyword → EmergencyCard with zero AI network calls', async ({ browser }) => {
	page = await (await browser.newContext()).newPage();
	await signIn(page, email);
	const aiCalls: string[] = [];
	page.on('request', (r) => r.url().includes('/api/ai/') && aiCalls.push(r.url()));
	await page.goto('/crabby');
	await page.waitForLoadState('networkidle');
	await say('my friend got a snake bite near the beach');
	const card = page.getByTestId('emergency-card');
	await expect(card).toBeVisible();
	await expect(card.getByRole('link', { name: 'Call 112' })).toHaveAttribute('href', 'tel:112');
	expect(aiCalls).toEqual([]);
	await card.getByRole('button', { name: 'Close' }).click();
});

test('answers only from tools; no phone or location in any payload', async () => {
	await say(`show me a cave — call me on +91 98220 99999, I am at 17.40012, 73.60011`);
	await expect(lastAnswer()).toContainText(`P8 Cave ${run}`);
	await say(`stays near e2e-p8-cave-${run}`);
	await expect(lastAnswer()).toContainText(`P8 Stay ${run}`);

	const log = await (await page.request.get('/api/ai/mock-log')).text();
	expect(log).toContain(`P8 Stay ${run}`); // the tool result did reach the model…
	expect(log).not.toMatch(/9822012345|9822054321|98220 99999|17\.40012|73\.60011/); // …but no PII
	expect(log).toContain('[number removed]');
	expect(log).toContain('[location removed]');
});

test("don't know → honest answer + verified alternatives", async () => {
	await say('where can I see a unicorn?');
	await expect(lastAnswer()).toContainText("I don't know");
	await expect(
		page.getByTestId('crabby-alternatives').last().getByRole('link').first()
	).toBeVisible();
});

test('plan preview changes nothing until Apply', async () => {
	const before = psql(
		`select count(*) from trips t join auth.users u on u.id = t.owner_id where u.email = '${email}'`
	);
	await say(`plan a cave day from P8 Station ${run}`);
	const card = page.getByTestId('action-preview').last();
	await expect(card).toBeVisible();
	await expect(card).toContainText(`P8 Cave ${run}`);
	expect(
		psql(
			`select count(*) from trips t join auth.users u on u.id = t.owner_id where u.email = '${email}'`
		)
	).toBe(before);
	await card.getByRole('button', { name: 'Apply' }).click();
	await page.waitForURL(/\/plan\/[0-9a-f-]{36}$/);
	await expect(page.getByTestId('plan-stop').filter({ hasText: `P8 Cave ${run}` })).toBeVisible();
});

test('21st message in a day is refused gracefully', async () => {
	psql(
		`update ai_usage set message_count = 20 where user_id = (select id from auth.users where email = '${email}') and date = (now() at time zone 'Asia/Kolkata')::date`
	);
	await page.goto('/crabby');
	await page.waitForLoadState('networkidle');
	await say('show me a cave');
	await expect(page.getByTestId('crabby-limit')).toContainText('20 questions for today');
});

test('reviewer queue: AI pre-screen flags; content helper drafts empty fields', async ({
	browser
}) => {
	const p = await (await browser.newContext()).newPage();
	const rev = `p8-rev-${run}@e2e.local`;
	await signIn(p, rev);
	psql(
		`insert into user_roles (user_id, role) select id, 'reviewer' from auth.users where email = '${rev}'`
	);
	const author = psql(`select id from auth.users where email = '${email}'`);
	const place = psql(`select id from places where slug = 'e2e-p8-cave-${run}'`);
	psql(
		`insert into reviews (user_id, entity_type, entity_id, group_type, text) values ('${author}', 'place', '${place}', 'family', 'mockspam buy cheap stuff ${run}')`
	);
	await p.goto('/admin/moderation');
	await expect(
		p
			.getByTestId('pending-review')
			.filter({ hasText: `mockspam buy cheap stuff ${run}` })
			.getByTestId('ai-flag')
	).toContainText('flagged');

	const draft = psql(
		`insert into places (slug, category, taluka_id, location, status, best_time_text) values ('e2e-p8-draft-${run}', 'cave', ${T}, 'SRID=4326;POINT(73.62 17.4)', 'in_review', 'Winter mornings') returning id`
	);
	psql(
		`insert into place_translations (place_id, lang, name) values ('${draft}', 'en', 'P8 Draft ${run}')`
	);
	await p.goto(`/admin/review/place/${draft}`);
	await p.getByRole('button', { name: 'Draft missing text with AI' }).click();
	await expect(p.getByText(/fields drafted/)).toBeVisible();
	expect(
		psql(
			`select count(*) from content_drafts where entity_id = '${draft}' and field = 'short_story' and status = 'draft'`
		)
	).toBe('3');
});

test('similar places on the place page (embeddings, no LLM) and the privacy page', async ({
	page: anon
}) => {
	const slug = psql(
		`select p.slug from places p join place_embeddings e on e.place_id = p.id where p.status = 'published' limit 1`
	);
	await anon.goto(`/place/${slug}`);
	await expect(
		anon.getByTestId('similar').getByRole('heading', { name: 'Similar places' })
	).toBeVisible();
	await anon.goto('/privacy');
	await expect(anon.getByRole('heading', { name: 'AI assistant (Crabby)' })).toBeVisible();
	await expect(anon.getByText(/Phone numbers — they are removed/)).toBeVisible();
});

test('group vote merge: preview + trade-off text, Apply drops the voted-down place', async () => {
	psql(
		`update ai_usage set message_count = 0 where user_id = (select id from auth.users where email = '${email}')`
	);
	const trip = psql(
		`select t.id from trips t join auth.users u on u.id = t.owner_id where u.email = '${email}' order by t.created_at desc limit 1`
	);
	const tok = psql(`select share_token from trips where id = '${trip}'`);
	const place = psql(`select id from places where slug = 'e2e-p8-cave-${run}'`);
	for (const g of ['g1', 'g2'])
		psql(`select cast_group_vote('${tok}', '${g}-${run}', '${g}', '${place}', 'down')`);
	await page.goto(`/plan/${trip}`);
	await page.getByRole('button', { name: 'Ask Crabby to merge votes' }).click();
	const res = page.getByTestId('merge-result');
	await expect(res).toContainText(`P8 Cave ${run}`);
	await res.getByRole('button', { name: 'Apply' }).click();
	await expect(res).toContainText('Done.');
	await expect(page.getByTestId('plan-stop').filter({ hasText: `P8 Cave ${run}` })).toHaveCount(0);
});
