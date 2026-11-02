import { expect, test } from '@playwright/test';
import { psql, signIn } from './helpers.ts';

// Listing action bar (DECISIONS T-4 / T-47): Directions → /navigate?to=; Add to trip → pick trip + day, the server
// adds the stop and re-times, the plan opens; guests sign in first; Save shares the saved list; Share copies a link.
test.skip(process.env.E2E_SUPABASE !== 'local', 'needs E2E_SUPABASE=local');

const run = Date.now().toString(36);
const SLUG = 'seed-beach-1';

test('guest: directions link, add to trip asks to sign in', async ({ page }) => {
	await page.goto(`/place/${SLUG}`);
	await page.waitForLoadState('networkidle'); // hydrated: the bar's buttons are JS
	const bar = page.getByTestId('action-bar');
	const [lon, lat] = psql(
		`select st_x(location::geometry) || ',' || st_y(location::geometry) from places where slug = '${SLUG}'`
	).split(',');
	await expect(bar.getByRole('link', { name: 'Directions' })).toHaveAttribute(
		'href',
		new RegExp(`^/navigate\\?to=${lat},${lon}&name=`)
	);
	await bar.getByRole('button', { name: 'Add to trip' }).click();
	await expect(page).toHaveURL(new RegExp(`/login\\?next=%2Fplace%2F${SLUG}$`));
});

test('signed in: add to day 2 of a trip; share copies the link', async ({ browser }) => {
	const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
	const page = await ctx.newPage();
	const email = `actions-${run}@e2e.local`;
	await signIn(page, email);
	const trip = psql(
		`insert into trips (owner_id, title, days, start_date, start_point, status)
		 select id, 'Actions ${run}', 2, (now() at time zone 'Asia/Kolkata')::date + 1,
		        jsonb_build_object('label','Start','lon',73.279,'lat',16.999), 'saved'
		 from auth.users where email = '${email}' returning id`
	);

	await page.goto(`/place/${SLUG}`);
	await page.waitForLoadState('networkidle');
	await page.evaluate(() => Object.defineProperty(navigator, 'share', { value: undefined }));
	const bar = page.getByTestId('action-bar');
	await bar.getByRole('button', { name: 'Share' }).click();
	await expect(page.getByText('Link copied')).toBeVisible();
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());

	await bar.getByRole('button', { name: 'Add to trip' }).click();
	const sheet = page.getByTestId('add-trip');
	await sheet.getByRole('button', { name: new RegExp(`Actions ${run}`) }).click();
	await expect(sheet.getByRole('heading', { name: 'Which day?' })).toBeVisible();
	await sheet.getByRole('button', { name: 'Day 2' }).click();
	await expect(page).toHaveURL(new RegExp(`/plan/${trip}$`));
	expect(
		psql(
			`select s.day || ':' || s.kind from trip_stops s join places p on p.id = s.entity_id
			 where s.trip_id = '${trip}' and p.slug = '${SLUG}'`
		)
	).toBe('2:place');
	await ctx.close();
});
