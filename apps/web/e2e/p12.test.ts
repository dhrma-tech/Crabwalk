import { expect, test, type Page } from '@playwright/test';
import { psql, signIn } from './helpers.ts';

// P12 Crabby AI (docs/P12 Crabby AI.md), against the scripted mock provider (AI_PROVIDER=mock).
test.skip(process.env.E2E_SUPABASE !== 'local', 'needs E2E_SUPABASE=local');
test.describe.configure({ mode: 'serial', timeout: 120_000 });

const run = Date.now();
let page: Page;
let trip = '';

test.beforeAll(async ({ browser }) => {
	page = await (await browser.newContext()).newPage();
	await page.setViewportSize({ width: 1280, height: 800 });
	const email = `p12-${run}@e2e.local`;
	await signIn(page, email);
	trip = psql(
		`insert into trips (owner_id, title, days, start_point, status) select id, 'P12 ${run}', 2, jsonb_build_object('label','Start','lon',73.279,'lat',16.999), 'saved' from auth.users where email = '${email}' returning id`
	);
	psql(
		`insert into trip_stops (trip_id, day, "order", entity_type, entity_id, kind)
		 select '${trip}', 1, 0, 'place', id, 'place' from places where slug = 'seed-fort-1'`
	);
});

/** Ask in the docked Crabby panel (laptop) or the /crabby page. */
async function ask(text: string) {
	const box = page.getByLabel('Ask Crabby…').locator('visible=true');
	if (!(await box.count()))
		await page.getByRole('button', { name: 'Crabby', exact: true }).first().click();
	await page.getByLabel('Ask Crabby…').locator('visible=true').fill(text);
	await page.getByRole('button', { name: 'Send' }).locator('visible=true').click();
}
const lastAnswer = () => page.getByTestId('bubble-crabby').locator('visible=true').last();

test('B: Crabby drives the app — filters, map, trip sections; admin refused', async () => {
	await page.goto('/crabby');
	await ask('show veg food please');
	await expect(page.getByTestId('crabby-driving')).toContainText('Crabby: filtering Food');
	await expect(page).toHaveURL(/\/food\?diet=veg$/);
	await expect(page.getByTestId('crabby-driving')).toHaveCount(0);

	await ask('open the admin page');
	await expect(lastAnswer()).toContainText("can't open that page");
	await page.waitForTimeout(1500);
	await expect(page).toHaveURL(/\/food\?diet=veg$/);

	await ask('show seed-beach-1 on the map');
	await expect(page).toHaveURL(/\/map\?focus=place%2Fseed-beach-1$/);

	// On a trip, Crabby switches the workspace section like the outline does.
	await page.goto(`/plan/${trip}`);
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Expenses', exact: true }).click(); // fold it
	await expect(page.getByRole('button', { name: 'Expenses', exact: true })).toHaveAttribute(
		'aria-expanded',
		'false'
	);
	await ask('go to expenses');
	await expect(page.getByRole('button', { name: 'Expenses', exact: true })).toHaveAttribute(
		'aria-expanded',
		'true'
	);
});

test('B: Stop cancels what Crabby is doing; data changes stay previews', async () => {
	await page.goto('/crabby');
	await ask('open my trip');
	await page.getByTestId('crabby-driving').getByRole('button', { name: 'Stop' }).click();
	await page.waitForTimeout(1200);
	await expect(page).toHaveURL(/\/crabby$/);

	await ask('add seed-temple-1 to my trip');
	const card = page.getByTestId('action-preview').locator('visible=true').last();
	await expect(card).toContainText('P12');
	expect(
		psql(`select count(*) from trip_stops s join places p on p.id = s.entity_id
		      where s.trip_id = '${trip}' and p.slug = 'seed-temple-1'`)
	).toBe('0');
	await card.getByRole('button', { name: 'Apply' }).click();
	await expect(page).toHaveURL(new RegExp(`/plan/${trip}$`));
	expect(
		psql(`select day from trip_stops s join places p on p.id = s.entity_id
		      where s.trip_id = '${trip}' and p.slug = 'seed-temple-1'`)
	).toBe('1');
});

test('C: ask, don\'t assume — a question card instead of guesses; "Let Crabby decide" is explained', async () => {
	await page.goto('/crabby');
	// No start point: Crabby offers our start points (app_config), not invented ones.
	await ask('plan a beach trip');
	const card = page.getByTestId('question-card').locator('visible=true').last();
	await expect(card).toContainText('Where does the trip start?');
	await expect(card.getByRole('radio', { name: 'Chiplun' })).toBeVisible();
	await expect(lastAnswer()).toContainText('a few quick questions first');
	const trips = () =>
		psql(
			`select count(*) from trips t join auth.users u on u.id = t.owner_id where u.email = 'p12-${run}@e2e.local'`
		);
	const before = trips();

	await card.getByRole('radio', { name: 'Chiplun' }).click();
	await card.getByRole('radio', { name: '2 days' }).click();
	await card.getByRole('radio', { name: /^Tomorrow/ }).click();
	await card.getByRole('radio', { name: 'Couple' }).click();
	await expect(card.getByRole('button', { name: 'Send answers' })).toBeEnabled();
	await card.getByRole('button', { name: 'Send answers' }).click();
	await expect(card).toContainText('Answers sent');

	// Pace is still open → asked next, with "Let Crabby decide".
	const pace = page.getByTestId('question-card').locator('visible=true').last();
	await expect(pace).toContainText('What pace suits you?');
	await pace.getByRole('radio', { name: 'Let Crabby decide' }).click();
	await pace.getByRole('button', { name: 'Send answers' }).click();
	const preview = page.getByTestId('action-preview').locator('visible=true').last();
	await expect(preview).toContainText("Pace: Balanced — Crabby's pick");
	await expect(preview).toContainText('Budget estimate for 2 people');
	await expect(lastAnswer()).toContainText('I picked Pace: Balanced');
	expect(trips()).toBe(before);
});

test('D: profile — quiz, correct / delete lines, sources, plain style; only the summary reaches the AI', async () => {
	await page.goto('/me');
	await page.getByTestId('crabby-profile-link').click();
	await expect(page).toHaveURL(/\/me\/crabby$/);
	const quiz = page.getByTestId('quiz');
	await quiz.getByLabel('How do you travel?').selectOption('car');
	await quiz.getByLabel('Mileage (km per litre)').fill('18');
	await quiz.getByLabel('Pace').selectOption('relaxed');
	await quiz.getByLabel('Food preference').selectOption('veg');
	await quiz.getByLabel('Seafood').selectOption('no');
	await quiz.getByLabel('Who is travelling?').selectOption('couple');
	await quiz.getByText('Beach', { exact: true }).click();
	await quiz.getByText('Fort', { exact: true }).click();
	await quiz.getByRole('button', { name: 'Save' }).click();
	const thinks = page.getByTestId('thinks');
	await expect(thinks).toContainText('Likes: Beach, Fort');
	await expect(thinks).toContainText('Travels by: Car (18 km/l)');

	// Delete one line, correct another (the user's words replace it).
	await thinks
		.getByTestId('thinks-line')
		.filter({ hasText: 'No seafood' })
		.getByRole('button', { name: 'Delete this line' })
		.click();
	await expect(thinks).not.toContainText('No seafood');
	await thinks
		.getByTestId('thinks-line')
		.filter({ hasText: 'Pace: Relaxed' })
		.getByRole('button', { name: 'Correct this line' })
		.click();
	await thinks.getByRole('textbox', { name: 'Correct this line' }).fill('Slow mornings, please');
	await thinks.getByRole('button', { name: 'Save' }).click();
	await expect(
		thinks.getByTestId('thinks-line').filter({ hasText: 'Slow mornings, please' })
	).toContainText('You');
	await expect(thinks).not.toContainText('Pace: Relaxed');

	// Activity source: on → views are kept; off → deleted.
	const sources = page.getByTestId('sources');
	await sources.getByRole('switch', { name: /What you search, open and save/ }).check();
	await sources.getByRole('button', { name: 'Save' }).click();
	await expect(sources).toContainText('Saved');
	await page.goto('/place/seed-fort-1');
	await page.waitForLoadState('networkidle');
	const acts = () =>
		psql(
			`select count(*) from user_activity a join auth.users u on u.id = a.user_id where u.email = 'p12-${run}@e2e.local'`
		);
	await expect.poll(acts).toBe('1');
	await page.goto('/me/crabby');
	await page
		.getByTestId('sources')
		.getByRole('switch', { name: /What you search, open and save/ })
		.uncheck();
	await page.getByTestId('sources').getByRole('button', { name: 'Save' }).click();
	await expect(page.getByTestId('sources')).toContainText('Saved');
	expect(acts()).toBe('0');

	// Plain style; the quiz answers count as known (only Dates is asked); the model sees the summary only.
	await page.getByTestId('persona').getByLabel(/Plain/).check();
	await page.getByTestId('persona').getByRole('button', { name: 'Save' }).click();
	await expect(page.getByTestId('persona')).toContainText('Saved');
	await page.goto('/crabby');
	await ask('plan a beach day from Chiplun');
	const card = page.getByTestId('question-card').locator('visible=true').last();
	await expect(card).toContainText('When do you start?');
	await expect(card).not.toContainText('What pace suits you?');
	await expect(card).not.toContainText('Who is travelling?');
	const log = await (await page.request.get('/api/ai/mock-log')).text();
	expect(log).toContain('Slow mornings, please');
	expect(log).toContain('Tone: plain');
	expect(log).not.toContain('No seafood');
});

test('E: ask our team — Pending, a verifier answers, the asker is told, others reuse the answer', async ({
	browser
}) => {
	const q = `where can I see a unicorn ${run}?`;
	await page.goto('/crabby');
	await ask(q);
	await expect(lastAnswer()).toContainText("I don't know that yet");
	const card = page.getByTestId('action-preview').locator('visible=true').last();
	await expect(card).toContainText('Ask our team?');
	await expect(card).toContainText('Usually answered within a day');
	await card.getByRole('button', { name: 'Apply' }).click();
	const mine = page.getByTestId('team-question').filter({ hasText: q });
	await expect(mine).toContainText('Pending');

	// A verifier answers from the team dashboard.
	const team = await (await browser.newContext()).newPage();
	const vEmail = `p12-verifier-${run}@e2e.local`;
	await signIn(team, vEmail);
	psql(
		`insert into user_roles (user_id, role) select id, 'verifier' from auth.users where email = '${vEmail}'`
	);
	await team.goto('/admin/questions');
	const open = team.getByTestId('team-open').filter({ hasText: q });
	await open
		.getByRole('textbox', { name: 'Answer', exact: true })
		.fill('Unicorns live only in stories; try the Seed Beach sunset.');
	await open.getByRole('button', { name: 'Send answer' }).click();
	await expect(team.getByTestId('team-answered').filter({ hasText: q })).toBeVisible();
	expect(
		psql(`select count(*) from push_queue p join auth.users u on u.id = p.user_id
		      where u.email = 'p12-${run}@e2e.local' and p.kind = 'team_answer'`)
	).toBe('1');

	// The asker sees it as new in Crabby.
	await page.goto('/crabby');
	await expect(mine).toContainText('Unicorns live only in stories');
	await expect(mine).toContainText('New · Answered by our team');

	// Someone else asking the same thing gets the stored answer straight away.
	await team.goto('/crabby');
	await team.getByLabel('Ask Crabby…').locator('visible=true').fill(q);
	await team.getByRole('button', { name: 'Send' }).locator('visible=true').click();
	await expect(team.getByTestId('bubble-crabby').locator('visible=true').last()).toContainText(
		'our team says: Unicorns live only in stories'
	);
	await team.context().close();
});
