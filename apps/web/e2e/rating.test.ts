import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { psql, signIn } from './helpers.ts';

// Hardening T1-05 (brief section 4.6): optimistic vote that reloads only this page's data, remembered
// traveller group, caption / "You:" line / "How ratings work", sub-score keys, axe, reduced motion.
test.skip(process.env.E2E_SUPABASE !== 'local', 'needs E2E_SUPABASE=local');
test.describe.configure({ mode: 'serial' });

const run = Date.now().toString(36);
const T = `(select id from talukas where name_en = 'Ratnagiri')`;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** A published eatery with 12 counted family votes (4 × 7, 3 × 3, 2 × 2): "Local legend", not New. */
function seedEatery(slug: string) {
	const id = psql(
		`insert into eateries (slug, taluka_id, location, status) values ('${slug}', ${T}, 'SRID=4326;POINT(73.3 16.99)', 'published') returning id`
	);
	psql(
		`insert into eatery_translations (eatery_id, lang, name) values ('${id}', 'en', 'E2E rating ${slug}')`
	);
	[4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 2, 2].forEach((level, i) => {
		const uid = psql(
			`insert into auth.users (id, email) values (gen_random_uuid(), 'r-${slug}-${i}@e2e.local') returning id`
		);
		psql(
			`insert into verdicts (user_id, entity_type, entity_id, group_type, level) values ('${uid}', 'eatery', '${id}', 'family', ${level})`
		);
	});
	return id;
}

let page: Page;
const slug = `e2e-rate-${run}`;
const email = `rater-${run}@e2e.local`;

test.beforeAll(async ({ browser }) => {
	seedEatery(slug);
	page = await (await browser.newContext()).newPage();
	await signIn(page, email);
});
test.afterAll(() => page.context().close());

test('no remembered group: pick one first; the vote shows at once and reloads only this page', async () => {
	await page.goto(`/food/${slug}`);
	await page.waitForLoadState('networkidle');
	const vote = page.getByTestId('verdict-vote');
	const gauge = page.getByTestId('verdict-gauge');
	await expect(vote.getByTestId('vote-pick-group')).toBeVisible();
	await expect(vote.getByRole('button', { name: 'Local legend' })).toBeDisabled();
	await expect(gauge.getByTestId('gauge-caption')).toHaveText('Most travellers say: Local legend');

	// The vote request is held until the page has shown the vote, so what we see cannot come from the server.
	const posts: string[] = [];
	const data: string[] = [];
	let release = () => {};
	const held = new Promise<void>((f) => (release = f));
	await page.route('**/api/verdicts', async (r) => {
		posts.push(r.request().postData() ?? '');
		await held;
		await r.continue();
	});
	page.on('request', (r) => {
		if (r.url().includes('__data.json'))
			data.push(new URL(r.url()).searchParams.get('x-sveltekit-invalidated') ?? '');
	});
	await vote.getByRole('radio', { name: 'Couple' }).click();
	// Time from the tap to the gauge's new count, measured in the page.
	await page.evaluate(() => {
		const w = window as unknown as { t0: number; t1: number };
		addEventListener('click', () => (w.t0 = performance.now()), { capture: true, once: true });
		const count = document.querySelector(
			'[data-testid="verdict-gauge"] [data-testid="gauge-count"]'
		)!;
		new MutationObserver((_, o) => {
			w.t1 = performance.now();
			o.disconnect();
		}).observe(count, { subtree: true, characterData: true, childList: true });
	});
	await vote.getByRole('button', { name: 'Local legend' }).click();
	await expect(vote.getByRole('button', { name: 'Local legend' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(gauge.getByTestId('gauge-count')).toHaveText('13 votes');
	await expect(gauge.getByTestId('gauge-you')).toHaveText('You: Local legend');
	const ms = await page.evaluate(() => {
		const w = window as unknown as { t0: number; t1: number };
		return w.t1 - w.t0;
	});
	console.log(`vote → gauge: ${ms.toFixed(1)} ms`);
	expect(ms).toBeLessThan(100);

	release();
	await expect.poll(() => data.length).toBe(1);
	await page.waitForLoadState('networkidle');
	expect(posts).toHaveLength(1);
	expect(JSON.parse(posts[0]!)).toMatchObject({ group_type: 'couple', level: 4, remember: true });
	// Root layout ('0') not reloaded; only the page node.
	expect(data[0]).toMatch(/^0/);
	await expect(gauge.getByTestId('gauge-count')).toHaveText('13 votes');
	expect(
		psql(
			`select group_type from user_preferences where user_id = (select id from auth.users where email = '${email}')`
		)
	).toBe('couple');
	await page.unroute('**/api/verdicts');

	// Next visit: the remembered group is chosen and voting works straight away.
	await page.reload();
	await expect(vote.getByRole('radio', { name: 'Couple' })).toHaveAttribute('aria-checked', 'true');
	await expect(vote.getByRole('button', { name: 'Skip' })).toBeEnabled();
	await expect(vote.getByTestId('vote-pick-group')).toHaveCount(0);
});

test('a failed vote reverts and shows the failure toast', async () => {
	await page.goto(`/food/${slug}`);
	await page.waitForLoadState('networkidle');
	const vote = page.getByTestId('verdict-vote');
	await page.route('**/api/verdicts', (r) => r.fulfill({ status: 500, body: '{}' }));
	await vote.getByRole('button', { name: 'Skip' }).click();
	await expect(page.getByText('Couldn’t send. Check the fields and try again.')).toBeVisible();
	await expect(vote.getByRole('button', { name: 'Skip' })).toHaveAttribute('aria-pressed', 'false');
	await expect(vote.getByRole('button', { name: 'Local legend' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(page.getByTestId('verdict-gauge').getByTestId('gauge-count')).toHaveText('13 votes');
	await page.unroute('**/api/verdicts');
});

test('sub-score dots: roving focus, arrow keys choose, one request when the choice settles', async () => {
	await page.goto(`/food/${slug}`);
	await page.waitForLoadState('networkidle');
	const taste = page.getByTestId('verdict-vote').getByTestId('tap-taste');
	const posts: string[] = [];
	page.on('request', (r) => {
		if (r.url().endsWith('/api/subscores')) posts.push(r.postData() ?? '');
	});
	await expect(taste.locator('[role="radio"][tabindex="0"]')).toHaveCount(1);
	await taste.getByRole('radio', { name: 'Taste: 2 of 5' }).click();
	for (let i = 0; i < 2; i++) await page.keyboard.press('ArrowRight');
	const four = taste.getByRole('radio', { name: 'Taste: 4 of 5' });
	await expect(four).toBeFocused();
	await expect(four).toHaveAttribute('aria-checked', 'true');
	await expect(four).toHaveAttribute('tabindex', '0');
	await expect.poll(() => posts.length).toBe(1);
	expect(JSON.parse(posts[0]!).scores).toEqual({ taste: 4 });
	// Hygiene is locked: the dots stay tappable (to explain why) but are marked disabled.
	await expect(page.getByTestId('tap-hygiene').getByRole('radio').first()).toBeDisabled();
});

test('"How ratings work" opens a sheet with four points; axe passes on the vote and gauge', async () => {
	await page.goto(`/food/${slug}`);
	await page.waitForLoadState('networkidle');
	const axe = await new AxeBuilder({ page })
		.withTags(TAGS)
		.include('[data-testid="verdict-vote"]')
		.include('[data-testid="verdict-gauge"]')
		.analyze();
	expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual(
		[]
	);
	await page.getByRole('button', { name: 'How ratings work' }).click();
	const sheet = page.getByRole('dialog', { name: 'How ratings work' });
	await expect(sheet).toBeVisible();
	await expect(sheet.getByRole('listitem')).toHaveCount(4);
	await sheet.getByRole('button', { name: 'Close' }).click();
	await expect(sheet).toBeHidden();
});

test.describe('reduced motion', () => {
	test.use({ reducedMotion: 'reduce' });
	test('a vote shows its final state with nothing left moving', async ({ browser }) => {
		const ctx = await browser.newContext({
			reducedMotion: 'reduce',
			storageState: await page.context().storageState()
		});
		const p = await ctx.newPage();
		await p.goto(`/food/${slug}`);
		await p.waitForLoadState('networkidle');
		const vote = p.getByTestId('verdict-vote');
		await vote.getByRole('button', { name: 'Go for it' }).click();
		await expect(p.getByTestId('verdict-gauge').getByTestId('gauge-you')).toHaveText(
			'You: Go for it'
		);
		const moving = await p.evaluate(
			() =>
				new Promise<string[]>((done) =>
					requestAnimationFrame(() =>
						requestAnimationFrame(() =>
							done(
								document
									.getAnimations()
									.filter(
										(a) =>
											a.playState === 'running' &&
											(a.effect as KeyframeEffect).target?.closest('[data-testid^="verdict-"]')
									)
									.map((a) => (a as CSSAnimation).animationName ?? 'script')
							)
						)
					)
				)
		);
		expect(moving).toEqual([]);
		// Percentage is already the final number (no count-up).
		await expect(p.getByTestId('verdict-gauge').getByTestId('gauge-pct')).toContainText('54%');
		await ctx.close();
	});
});
