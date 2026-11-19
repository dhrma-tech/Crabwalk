import { lonLat } from '../../listings.ts';
import { istToday } from '../../planner/data.ts';
import { obj, str, read, type Tool } from './shared.ts';

export const getConditionsTool: Tool = {
	def: {
		name: 'get_conditions',
		description:
			"Current monsoon status, today's tides and latest weather for a place, from our caches.",
		parameters: obj({ slug: str('Place slug') }, ['slug'])
	},
	async run(ctx, a) {
		const { db } = ctx;
		const { s } = read(a);
		const { data: p } = await db
			.from('places')
			.select('slug, monsoon_status, monsoon_reason, is_tide_dependent, tide_station_id, location')
			.eq('slug', s('slug') ?? '')
			.eq('status', 'published')
			.maybeSingle();
		if (!p) return { found: false };
		const [{ data: tide }, { data: wx }] = await Promise.all([
			p.tide_station_id
				? db
						.from('tide_cache')
						.select('extremes')
						.eq('station_id', p.tide_station_id)
						.eq('date', istToday())
						.maybeSingle()
				: Promise.resolve({ data: null }),
			db
				.from('weather_cache')
				.select('summary, fetched_at, weather_points(location)')
				.gte('fetched_at', new Date(Date.now() - 3 * 3600e3).toISOString())
				.limit(40)
		]);
		const c = lonLat(p.location);
		const w = c
			? (wx ?? [])
					.map((x) => ({
						x,
						p: lonLat((x.weather_points as { location: unknown } | null)?.location)
					}))
					.filter((x) => x.p)
					.sort(
						(a, b) =>
							Math.hypot(a.p![0] - c[0], a.p![1] - c[1]) -
							Math.hypot(b.p![0] - c[0], b.p![1] - c[1])
					)[0]?.x
			: undefined;
		const sum = w?.summary as
			{ temp_c?: number; rain_1h_mm?: number; description?: string } | undefined;
		return {
			monsoon: p.monsoon_status,
			monsoon_reason: p.monsoon_reason,
			tide_dependent: p.is_tide_dependent,
			tides_today: (
				(tide?.extremes as { type: string; time: string; height_m: number }[] | null) ?? []
			).map((e) => ({
				type: e.type,
				time_ist: new Intl.DateTimeFormat('en-GB', {
					hour: '2-digit',
					minute: '2-digit',
					timeZone: 'Asia/Kolkata'
				}).format(new Date(e.time)),
				height_m: Math.round(e.height_m * 10) / 10
			})),
			weather: sum
				? {
						temp_c: sum.temp_c != null ? Math.round(sum.temp_c) : null,
						rain_last_hour_mm: sum.rain_1h_mm ?? 0,
						description: sum.description,
						as_of: w!.fetched_at.slice(11, 16) + ' UTC'
					}
				: 'no recent weather data'
		};
	}
};
