import { expect, test } from '@playwright/test';
import { psql } from './helpers.ts';

// Discover (phase-10b step E, T-9/T-24): "Today on the coast" shows only fresh cached data for the region's
// default point and switches to the nearest point after "Use my location"; grouped search + recent searches;
// each category has its own heading, canonical and description.
test.skip(process.env.E2E_SUPABASE !== 'local', 'needs E2E_SUPABASE=local');

const istDay = (ms: number) => new Date(ms + 5.5 * 3600e3).toISOString().slice(0, 10);
const coords = (name: string) =>
	psql(
		`select st_x(location::geometry) || ',' || st_y(location::geometry) from weather_points where name = '${name}'`
	)
		.split(',')
		.map(Number) as [number, number];

test('today strip: default point, then the nearest point; stale weather is hidden', async ({
	browser
}) => {
	const def = psql(
		`select w.name from regions r join weather_points w on w.id = r.default_weather_point_id limit 1`
	);
	const other = psql(
		`select name from weather_points where name <> '${def}' order by location <-> (select location from weather_points where name = '${def}') desc limit 1`
	);
	const station = psql(
		`select id from tide_stations order by location <-> (select location from weather_points where name = '${def}') limit 1`
	);
	const wx = (name: string, temp: number, age: string) =>
		psql(
			`insert into weather_cache (point_id, fetched_at, payload, summary) select id, now() - interval '${age}', '{}', '{"temp_c": ${temp}, "condition": "Rain"}' from weather_points where name = '${name}' returning id`
		);
	const ids = [wx(def, 29, '10 minutes'), wx(other, 24, '10 minutes')];
	const lowAt = new Date(Date.now() + 2 * 3600e3).toISOString();
	const extremes = JSON.stringify([
		{ type: 'low', time: lowAt, height_m: 0.4 },
		{ type: 'high', time: new Date(Date.now() + 8 * 3600e3).toISOString(), height_m: 2.1 }
	]);
	const tideIds = station
		? [istDay(Date.now()), istDay(Date.now() + 864e5)]
				.map((d) =>
					psql(
						`insert into tide_cache (station_id, date, extremes, provider) values ('${station}', '${d}', '${extremes}', 'tidecheck') on conflict (station_id, date) do nothing returning id`
					)
				)
				.filter(Boolean)
		: [];
	try {
		const [lon, lat] = coords(other);
		const ctx = await browser.newContext({
			permissions: ['geolocation'],
			geolocation: { latitude: lat, longitude: lon }
		});
		const page = await ctx.newPage();
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		const weather = page.getByTestId('today-weather');
		await expect(weather).toContainText(`Weather · ${def}`);
		await expect(weather).toContainText('29°C · Rain');
		await expect(weather.getByRole('link', { name: 'Weather data by OpenWeather' })).toBeVisible();
		if (station) {
			await expect(page.getByTestId('today-tide')).toContainText('Next low tide ·');
			await expect(page.getByTestId('today-tide').getByRole('link')).toHaveText(/Tide data/);
		}
		await page.getByRole('button', { name: 'Show places near me' }).click();
		await expect(weather).toContainText(`Weather · ${other}`);
		await expect(weather).toContainText('24°C');

		// Older than 3 h → not shown at all (no stale "live" data).
		psql(`delete from weather_cache where id in ('${ids.join("','")}')`);
		ids.length = 0;
		ids.push(wx(def, 31, '4 hours'));
		await page.goto('/');
		await expect(page.getByTestId('today')).toBeVisible({ visible: !!station });
		await expect(page.getByTestId('today-weather')).toHaveCount(0);
		await ctx.close();
	} finally {
		psql(`delete from weather_cache where id in ('${ids.join("','")}')`);
		if (tideIds.length) psql(`delete from tide_cache where id in ('${tideIds.join("','")}')`);
	}
});

test('search groups results by kind and remembers recent searches', async ({ page }) => {
	const dish = psql(`select name from dish_translations where lang = 'en' order by name limit 1`);
	test.skip(!dish, 'no dishes in this database');
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	const box = page.locator('#search');
	await box.fill(dish.slice(0, 6));
	const results = page.getByTestId('search-results');
	await expect(results.getByRole('region', { name: 'Dishes' })).toBeVisible();
	await results.getByRole('link', { name: dish }).first().click();
	await expect(page).toHaveURL(/\/taste-konkan\//);
	await page.goto('/');
	await page.locator('#search').focus();
	await expect(results.getByRole('region', { name: 'Recent searches' })).toBeVisible();
	await results.getByRole('button', { name: dish.slice(0, 6) }).click();
	await expect(page.locator('#search')).toHaveValue(dish.slice(0, 6));
	await page.keyboard.press('Escape');
});

test('a category has its own heading, canonical and description', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto('/?category=fort');
	await expect(page.getByRole('heading', { level: 1, name: 'Fort' })).toBeVisible();
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/\?category=fort$/);
	await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /^Fort on the/);
});
