import AxeBuilder from '@axe-core/playwright';
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
	const panel = page.getByTestId('crabby-chat').locator('visible=true');
	await panel.getByLabel('Ask Crabby…').fill(text);
	await panel.getByRole('button', { name: 'Send' }).click();
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
	// Earlier runs' answers would be (rightly) reused for this near-identical question.
	psql(
		`update team_questions set expires_at = now() where question like 'where can I see a unicorn%' and status = 'answered'`
	);
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
	// Leave no reusable unicorn answer behind for other suites.
	psql(`update team_questions set expires_at = now() where question = '${q}'`);
});

test("F: Crabby at the spot — QR link, place facts + today's trip; signed-out visitors get the FAQ", async ({
	browser
}) => {
	const [code, slug] = psql(
		`select q.code || '|' || p.slug from qr_codes q join places p on p.id = q.entity_id where q.entity_type = 'place' and p.status = 'published' order by q.code limit 1`
	).split('|');
	const name = psql(
		`select t.name from places p join place_translations t on t.place_id = p.id and t.lang = 'en' where p.slug = '${slug}'`
	);
	// Today's trip with a stop later today.
	const today = psql(
		`insert into trips (owner_id, title, days, start_date, start_point, status) select id, 'P12 today ${run}', 1, (now() at time zone 'Asia/Kolkata')::date, jsonb_build_object('label','Start','lon',73.279,'lat',16.999), 'saved' from auth.users where email = 'p12-${run}@e2e.local' returning id`
	);
	psql(
		`insert into trip_stops (trip_id, day, "order", entity_type, entity_id, kind, arrive_at)
		 select '${today}', 1, 0, 'place', id, 'place', now() + interval '2 hours' from places where slug = 'seed-temple-1'`
	);

	const scan = await (await page.request.get(`/q/${code}`)).text();
	expect(scan).toContain(`href="/crabby?spot=${code}"`);
	expect(scan).toContain('Ask Crabby about this spot');

	await page.goto(`/crabby?spot=${code}`);
	await expect(page.getByTestId('spot')).toContainText(name);
	await page.getByRole('button', { name: "What's next on my trip?" }).click();
	await expect(lastAnswer()).toContainText('next on your trip:');
	await expect(lastAnswer()).toContainText('Seed Temple 1');
	const log = await (await page.request.get('/api/ai/mock-log')).text();
	expect(log).toContain(`The user is at ${name} right now`);

	const anon = await (await browser.newContext()).newPage();
	await anon.goto(`/crabby?spot=${code}`);
	await expect(anon.getByTestId('spot')).toContainText(name);
	await expect(anon.getByTestId('spot-faq')).toContainText('Sign in to ask Crabby about this spot');
	await expect(anon.getByLabel('Ask Crabby…')).toHaveCount(0);
	await anon.context().close();
});

test('G: group chat — live messages, @Crabby with a poll, proactive within the cap, editor applies a card', async ({
	browser
}) => {
	const token = `p12g${run}`;
	psql(
		`insert into trip_invites (trip_id, role, token, created_by) select id, 'editor', '${token}', owner_id from trips where id = '${trip}'`
	);
	const ed = await (await browser.newContext()).newPage();
	await ed.setViewportSize({ width: 1280, height: 800 });
	await signIn(ed, `p12-ed-${run}@e2e.local`);
	await ed.goto(`/plan/join/${token}`);
	await expect(ed).toHaveURL(new RegExp(`/plan/${trip}$`));
	await page.goto(`/plan/${trip}`);
	const chat = (p: Page) => p.getByTestId('trip-chat');
	const say = async (p: Page, t: string) => {
		await chat(p).getByLabel('Message the group — tag @Crabby to ask').fill(t);
		await chat(p).getByRole('button', { name: 'Send to group' }).click();
	};
	const crabbyMsgs = (p: Page) =>
		chat(p).locator('[data-testid="chat-message"][data-crabby="true"]');
	await expect(chat(page)).toContainText('Crabby reads this chat');

	await say(page, `Hi all ${run}`);
	await expect(chat(ed).getByText(`Hi all ${run}`)).toBeVisible({ timeout: 3000 });

	// Tagged: Crabby answers on the tagger's cap, posts a poll; it knows the group's totals (owner is veg).
	await say(ed, '@Crabby which beach?');
	await expect(crabbyMsgs(page).filter({ hasText: "I've posted a poll" })).toContainText(
		'1 of you veg',
		{
			timeout: 15_000
		}
	);
	const poll = chat(page).locator('[data-kind="poll"]').last();
	await expect(poll).toContainText('Which beach?');
	await poll.getByRole('button').first().click();
	await expect(poll).toContainText('1 votes');

	// Untagged planning question: Crabby may chip in once; the cooldown keeps it quiet right after.
	const before = await crabbyMsgs(page).count();
	await say(page, 'where should we eat?');
	await expect(crabbyMsgs(page)).toHaveCount(before + 1, { timeout: 15_000 });
	await say(page, 'which fort?');
	await page.waitForTimeout(4000);
	await expect(crabbyMsgs(page)).toHaveCount(before + 1);
	expect(psql(`select proactive from crabby_group_usage where trip_id = '${trip}'`)).toBe('1');

	// A plan change is a card any editor applies (once).
	await say(ed, '@Crabby drop seed-fort-1');
	const card = chat(ed).locator('[data-kind="card"]').filter({ hasText: 'Crabby suggests' }).last();
	await card.getByRole('button', { name: 'Apply' }).click({ timeout: 15_000 });
	await expect(chat(ed).locator('[data-kind="system"]').last()).toContainText('Applied');
	expect(
		psql(`select count(*) from trip_stops s join places p on p.id = s.entity_id
		      where s.trip_id = '${trip}' and p.slug = 'seed-fort-1'`)
	).toBe('0');

	// Moderation: an unsafe message is refused and never stored.
	await say(page, 'mockunsafe words');
	await expect(page.getByText("That message wasn't sent")).toBeVisible();
	expect(
		psql(`select count(*) from trip_messages where trip_id = '${trip}' and body like 'mockunsafe%'`)
	).toBe('0');
	// The old no-login vote link is gone.
	expect((await page.request.get('/plan/vote/anything')).status()).toBe(404);
	await ed.context().close();
});

test('H: trip report — live, Pending not guessed, finalize with summary, posted to chat, versions, share link', async ({
	browser
}) => {
	await page.goto(`/plan/${trip}/report`);
	const report = page.getByTestId('trip-report');
	await expect(page.getByTestId('report-version')).toHaveText('Live — follows the plan');
	await expect(report).toContainText(`P12 ${run}`);
	await expect(report).toContainText('Seed Temple 1');
	await expect(page.getByTestId('report-asof')).toContainText('Data as of');
	await expect(page.getByTestId('report-pending')).toContainText('Trip dates');
	await expect(page.getByTestId('report-emergency')).toContainText('112');

	await page.getByRole('button', { name: 'Finalize report' }).click();
	await expect(page).toHaveURL(/\/report\?v=1$/);
	// (The 13-digit run id in the title looks like a phone number, so the scrubber removes it before the model.)
	await expect(page.getByTestId('report-summary')).toContainText(
		'Mock summary: P12 [number removed], 2 day(s).'
	);
	expect(
		psql(`select count(*) from trip_messages where trip_id = '${trip}' and kind = 'report'`)
	).toBe('1');

	// The live report follows plan edits; version 1 stays as it was.
	psql(
		`insert into trip_stops (trip_id, day, "order", entity_type, entity_id, kind)
		 select '${trip}', 2, 0, 'place', id, 'place' from places where slug = 'seed-beach-1'`
	);
	await page.goto(`/plan/${trip}/report`);
	await expect(page.getByTestId('trip-report')).toContainText('Seed Beach 1');
	await page.goto(`/plan/${trip}/report?v=1`);
	await expect(page.getByTestId('trip-report')).not.toContainText('Seed Beach 1');

	// Anyone with the read-only link sees the latest version; tripmates are a count, nobody is named.
	const shareToken = psql(`select share_token from trips where id = '${trip}'`);
	const anon = await (await browser.newContext()).newPage();
	await anon.goto(`/plan/share/${shareToken}/report`);
	await expect(anon.getByTestId('trip-report')).toContainText(`P12 ${run}`);
	await expect(anon.getByTestId('trip-report')).toContainText('tripmates');
	await expect(anon.getByTestId('trip-report')).not.toContainText(`p12-ed-${run}`);
	await anon.context().close();
});

test('I: books the unbookable — owner counters once, traveller accepts (phone shared only then); team relays unclaimed', async ({
	browser
}) => {
	const owner = await (await browser.newContext()).newPage();
	const oEmail = `p12-owner-${run}@e2e.local`;
	await signIn(owner, oEmail);
	psql(
		`update stays set owner_id = (select id from auth.users where email = '${oEmail}') where slug = 'seed-stay-2'`
	);
	psql(`update stays set whatsapp = '9822000111' where slug = 'seed-stay-1'`);
	try {
		// Traveller asks from the stay page.
		await page.goto('/stays/seed-stay-2');
		const form = page.getByTestId('request-form');
		await form.getByRole('button', { name: 'Ask the owner' }).click();
		const d = (n: number) =>
			new Date(Date.now() + (5.5 + 24 * n) * 3600e3).toISOString().slice(0, 10);
		await form.getByLabel('Check-in').fill(d(10));
		await form.getByLabel('Check-out').fill(d(12));
		await form.getByLabel('Guests').fill('3');
		await form.getByLabel('Budget per night (₹, optional)').fill('2500');
		await form.getByRole('button', { name: 'Send request' }).click();
		await expect(form).toContainText('Request sent');
		const queued = (email: string, kind: string) =>
			psql(
				`select count(*) from push_queue q join auth.users u on u.id = q.user_id where u.email = '${email}' and q.kind = '${kind}'`
			);
		expect(queued(oEmail, 'stay_request')).toBe('1');

		// The owner sees no phone yet, and counters once.
		await owner.goto('/owner/requests');
		const req = owner.getByTestId('incoming-request').first();
		await expect(req).toContainText('3 guests');
		await expect(req.getByTestId('request-phone')).toHaveCount(0);
		await req.getByLabel('Counter offer').check();
		await req.getByLabel('Price (₹)').fill('2800');
		await req.getByRole('button', { name: 'Send answer' }).click();
		await expect(
			owner.getByTestId('incoming-request').first().getByTestId('request-status')
		).toHaveText('owner offered a price');
		expect(queued(`p12-${run}@e2e.local`, 'stay_reply')).toBe('1');

		// The traveller accepts with a phone; only now does the owner see it.
		await page.goto('/me/requests');
		const mine = page.getByTestId('my-request').filter({ hasText: 'owner offered a price' });
		await expect(mine).toContainText('The owner offers ₹2,800');
		await mine.getByLabel('Your phone for the owner').fill('+91 98000 11122');
		await mine.getByRole('button', { name: 'Accept and share my phone' }).click();
		await expect(page.getByTestId('my-request').first().getByTestId('request-status')).toHaveText(
			'accepted'
		);
		await owner.reload();
		await expect(owner.getByTestId('request-phone').first()).toContainText('+91 98000 11122');

		// Unclaimed stay through Crabby: a preview first, then our team relays and enters the answer.
		await page.goto('/crabby');
		await ask('is seed-stay-1 free next week?');
		const card = page.getByTestId('action-preview').locator('visible=true').last();
		await expect(card).toContainText('No booking or payment on Crabwalk');
		await card.getByRole('button', { name: 'Apply' }).click();
		await expect(page).toHaveURL(/\/me\/requests$/);
		const team = await (await browser.newContext()).newPage();
		const vEmail = `p12-relay-${run}@e2e.local`;
		await signIn(team, vEmail);
		psql(
			`insert into user_roles (user_id, role) select id, 'verifier' from auth.users where email = '${vEmail}'`
		);
		await team.goto('/admin/requests');
		const rid = psql(
			`select r.id from stay_requests r join stays s on s.id = r.entity_id join auth.users u on u.id = r.user_id
			 where s.slug = 'seed-stay-1' and u.email = 'p12-${run}@e2e.local' order by r.created_at desc limit 1`
		);
		const relay = team.locator(`[data-testid="incoming-request"][data-id="${rid}"]`);
		await expect(relay.getByTestId('relay-link')).toHaveAttribute(
			'href',
			/^https:\/\/wa\.me\/919822000111\?text=/
		);
		await relay.getByLabel('Available', { exact: true }).check();
		await relay.getByLabel('Price (₹)').fill('2200');
		await relay.getByRole('button', { name: 'Send answer' }).click();
		await expect(relay.getByTestId('request-status')).toHaveText('available');
		await page.goto('/me/requests');
		await expect(
			page.getByTestId('my-request').filter({ hasText: 'Available at ₹2,200' })
		).toBeVisible();
		await team.context().close();
	} finally {
		psql(`update stays set owner_id = null where slug = 'seed-stay-2'`);
		psql(`update stays set whatsapp = null where slug = 'seed-stay-1'`);
		await owner.context().close();
	}
});

test('J: Host Crabby — an owner says it in Marathi; Crabby fills prices, phone stays out of the AI', async ({
	browser
}) => {
	const owner = await (await browser.newContext()).newPage();
	const oEmail = `p12-host-${run}@e2e.local`;
	await signIn(owner, oEmail);
	const stayId = psql(`select id from stays where slug = 'seed-stay-2'`);
	psql(
		`update stays set owner_id = (select id from auth.users where email = '${oEmail}') where id = '${stayId}'`
	);
	psql(
		`insert into user_roles (user_id, role, entity_type, entity_id) select id, 'owner', 'stay', '${stayId}' from auth.users where email = '${oEmail}'`
	);
	const price = () =>
		psql(`select coalesce(price_min::text, 'null') from stays where id = '${stayId}'`);
	const before = price();
	try {
		await owner.goto(`/owner/stay/${stayId}`);
		const host = owner.getByTestId('host-crabby');
		await host
			.getByLabel('Fill with Crabby')
			.fill('खोल्या 2000 ते 3500 रुपये प्रति रात्र, फोन 9822012345');
		await host.getByRole('button', { name: 'Fill the form' }).click();
		await expect(host).toContainText('Filled — check the fields below');
		const form = owner.getByTestId('owner-form');
		await expect(form.locator('input[name="price_min"]')).toHaveValue('2000');
		await expect(form.locator('input[name="price_max"]')).toHaveValue('3500');
		await expect(form.locator('input[name="phone"]')).toHaveValue('9822012345');
		const log = await (await owner.request.get('/api/ai/mock-log')).text();
		expect(log).toContain('खोल्या 2000 ते 3500');
		expect(log).not.toContain('9822012345');
		// Nothing is saved until the owner presses Save.
		expect(price()).toBe(before);
	} finally {
		psql(`update stays set owner_id = null where id = '${stayId}'`);
		await owner.context().close();
	}
});

test('K: snap and ask — off until the traveller allows photos; a match from our data, or "not sure" + a lead', async () => {
	const png = Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
		'base64'
	);
	const shot = async (caption: string) => {
		await page.goto('/crabby');
		const panel = page.getByTestId('crabby-chat').locator('visible=true');
		await panel.getByLabel('Ask Crabby…').fill(caption);
		await panel
			.getByTestId('snap-input')
			.setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png });
	};
	await shot('what is seed fort 1?');
	await expect(page.getByTestId('snap-consent')).toBeVisible();

	await page.goto('/me/crabby');
	await page
		.getByTestId('sources')
		.getByRole('switch', { name: /Photos I send to Crabby/ })
		.check();
	await page.getByTestId('sources').getByRole('button', { name: 'Save' }).click();
	await expect(page.getByTestId('sources')).toContainText('Saved');

	await shot('what is seed fort 1?');
	await expect(page.getByTestId('snap-match')).toContainText('Seed Fort 1');
	const log = await (await page.request.get('/api/ai/mock-log')).text();
	expect(log).toContain('mock-vision');
	expect(log).toContain('data:image/jpeg;base64'); // re-encoded on the phone (no EXIF)

	const leads = () => psql(`select count(*) from ai_leads where kind = 'photo'`);
	const before = Number(leads());
	await shot('what is this?');
	await expect(page.getByTestId('snap-unsure')).toBeVisible();
	await expect(
		page.getByTestId('snap-unsure').getByRole('button', { name: 'Ask our team' })
	).toBeVisible();
	expect(Number(leads())).toBe(before + 1);
});

test('L: reel to trip — YouTube link → reality check from our data → added to the trip; Instagram asks for the caption; unknown → lead', async () => {
	await page.goto('/crabby');
	await ask('https://youtu.be/Seed-Fort-1-sunset-walk');
	const found = page.getByTestId('reel-found').locator('visible=true').last();
	await expect(found.getByTestId('reality-check')).toContainText('Seed Fort 1');
	await expect(found.getByTestId('reality-check')).toContainText('in monsoon');
	await expect(found.getByTestId('reality-check')).toContainText('Travellers say');
	const card = page.getByTestId('action-preview').locator('visible=true').last();
	await expect(card).toContainText('Add to “');
	await card.getByRole('button', { name: 'Apply' }).click();
	await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}$/);
	const id = page.url().split('/').at(-1)!;
	expect(
		psql(
			`select count(*) from trip_list_items i join places p on p.id = i.entity_id where i.trip_id = '${id}' and p.slug = 'seed-fort-1'`
		)
	).toBe('1');

	// Instagram can't be read: Crabby asks for the caption; the next message is that reel's caption.
	await page.goto('/crabby');
	await ask('https://www.instagram.com/reel/AbC123/');
	await expect(page.getByTestId('reel-caption')).toBeVisible();
	await ask('मंदिर दर्शन, सकाळची आरती #konkan #ratnagiri');
	await expect(page.getByTestId('reel-found').locator('visible=true').last()).toContainText(
		'Seed Temple 1'
	);

	const leads = () => psql(`select count(*) from ai_leads where kind = 'reel'`);
	const before = Number(leads());
	await ask('https://www.youtube.com/watch?v=Unicorn-Island-Tour');
	const none = page.getByTestId('reel-none').locator('visible=true').last();
	await expect(none).toContainText('Not in our list yet');
	await expect(none.getByRole('button', { name: 'Ask our team' })).toBeVisible();
	expect(Number(leads())).toBe(before + 1);
});

test('M: trip journal — interview → story only from answers; phone media; shared photo; one-tap vote; share link on/off', async ({
	browser
}) => {
	await page.goto(`/plan/${trip}/journal`);
	const interview = page.getByTestId('journal-interview');
	// Earlier steps edit this trip's stops, so answer whichever stop comes first.
	await interview
		.getByRole('textbox', { name: /^How was / })
		.first()
		.fill('Climbed the walls at sunset. Call me 9822000111');
	await interview.getByLabel('What will you remember most?').fill('The wind on the ramparts.');
	await expect(interview.getByRole('link', { name: 'Vote or review' }).first()).toHaveAttribute(
		'href',
		/^\/place\/seed-[a-z]+-1#vote$/
	);
	await interview.getByRole('button', { name: 'Save answers' }).click();
	await expect(interview.getByRole('status')).toHaveText('Saved');
	await interview.getByRole('button', { name: 'Write my story' }).click();
	const story = page.getByTestId('journal-story');
	await expect(story).toContainText('Mock story: Climbed the walls at sunset.');
	await expect(story).toContainText('The wind on the ramparts.');
	const log = await (await page.request.get('/api/ai/mock-log')).text();
	expect(log).toContain("Write the traveller's trip story");
	expect(log).not.toContain('9822000111'); // no phone numbers reach the AI
	await expect(page.getByTestId('journal-privacy')).toHaveText('Private — only you can see it.');

	// Photos stay on the phone until one is added to the journal.
	const png = Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
		'base64'
	);
	await page
		.getByTestId('journal-add')
		.setInputFiles({ name: 'beach.png', mimeType: 'image/png', buffer: png });
	await expect(page.getByTestId('journal-local')).toHaveCount(1);
	expect(
		psql(
			`select count(*) from journal_photos p join trip_journals j on j.id = p.journal_id where j.trip_id = '${trip}'`
		)
	).toBe('0');
	await page.getByTestId('journal-local').getByRole('button', { name: 'Add to journal' }).click();
	await expect(page.getByTestId('journal-shared').locator('img')).toHaveCount(1);
	expect(
		psql(
			`select count(*) from journal_photos p join trip_journals j on j.id = p.journal_id where j.trip_id = '${trip}'`
		)
	).toBe('1');

	// Share link: readable signed out while on; gone when turned off.
	await page.getByRole('button', { name: 'Turn on share link' }).click();
	await expect(page.getByTestId('journal-privacy')).toContainText('Anyone with the link');
	const token = psql(`select share_token from trip_journals where trip_id = '${trip}'`);
	const anon = await (await browser.newContext()).newPage();
	await anon.goto(`/journal/${token}`);
	await expect(anon.getByTestId('journal-shared-page')).toContainText(
		'Mock story: Climbed the walls'
	);
	await expect(anon.getByTestId('journal-shared-page').locator('img')).toHaveCount(1);
	await page.getByRole('button', { name: 'Turn off share link' }).click();
	await expect(page.getByTestId('journal-privacy')).toHaveText('Private — only you can see it.');
	expect((await anon.goto(`/journal/${token}`))?.status()).toBe(404);
	await anon.context().close();
});

// Step N: WCAG 2.2 AA on every page P12 added or changed — laptop light EN and phone dark MR.
test('N: a11y — P12 pages pass axe', async () => {
	psql(
		`insert into user_roles (user_id, role) select id, 'verifier' from auth.users where email = 'p12-${run}@e2e.local' on conflict do nothing`
	);
	psql(`update trip_journals set share_token = 'p12-a11y-${run}' where trip_id = '${trip}'`);
	const problems: string[] = [];
	const pages = [
		'/crabby',
		'/me/crabby',
		'/me/requests',
		`/plan/${trip}`,
		`/plan/${trip}/report`,
		`/plan/${trip}/journal`,
		`/journal/p12-a11y-${run}`,
		'/admin/questions',
		'/admin/requests',
		'/privacy'
	];
	for (const [w, h, scheme, locale] of [
		[1280, 800, 'light', 'en'],
		[390, 844, 'dark', 'mr']
	] as const) {
		await page.setViewportSize({ width: w, height: h });
		await page.emulateMedia({ colorScheme: scheme });
		await page
			.context()
			.addCookies([{ name: 'PARAGLIDE_LOCALE', value: locale, url: 'http://localhost:4173' }]);
		for (const path of pages) {
			await page.goto(path);
			await page.waitForLoadState('networkidle');
			if (path === '/crabby') {
				// With Crabby's P12 cards on screen: a reel reality check.
				const box = page.locator('#crabby-input').locator('visible=true'); // any language
				await box.fill('https://youtu.be/Seed-Fort-1-a11y');
				await box.press('Enter');
				await expect(
					page.getByTestId('reality-check').locator('visible=true').first()
				).toBeVisible();
			}
			const r = await new AxeBuilder({ page })
				.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
				.exclude('.maplibregl-canvas')
				.analyze();
			problems.push(
				...r.violations.map(
					(v) =>
						`${w} ${scheme} ${locale} ${path}: ${v.id} (${v.impact}): ${v.nodes
							.map((n) => n.target.join(' '))
							.slice(0, 3)
							.join(' | ')}`
				)
			);
		}
	}
	await page.context().clearCookies({ name: 'PARAGLIDE_LOCALE' });
	expect(problems).toEqual([]);
});
