// Planner data layer (BACKEND §10.2 steps 1, 2, 5): turns hours, tides, weather, crowd, festivals,
// alerts and monsoon status into per-day windows + scores for the pure engine.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/db.types.ts';
import {
	estimatedLeg,
	type DayOpen,
	type EateryCand,
	type PlaceCand,
	type Pt,
	type StayCand,
	type Travel,
	type Win
} from '#lib/planner/engine.ts';
import { lonLat } from '../listings.ts';

type DB = SupabaseClient<Database>;
export type Diet = 'veg' | 'non_veg' | 'jain';

const hm = (t: string) => {
	const [h, m] = t.split(':').map(Number);
	return h! * 60 + m!;
};
/** IST calendar date + n days → YYYY-MM-DD and weekday (0 = Sunday). */
export const addDays = (date: string, n: number) => {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + n);
	return { date: d.toISOString().slice(0, 10), weekday: d.getUTCDay() };
};
export const istToday = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const istMinutes = (iso: string, date: string) =>
	Math.round((Date.parse(iso) - Date.parse(`${date}T00:00:00+05:30`)) / 60000);

const intersect = (a: Win[], b: Win[]): Win[] =>
	a.flatMap(([x1, y1]) =>
		b.map(([x2, y2]) => [Math.max(x1, x2), Math.min(y1, y2)] as Win).filter(([x, y]) => y > x)
	);

/** Opening for one weekday. No row / unknown → daylight, unconfirmed (P7-3); empty times → closed. */
export function hoursOpen(
	rows: { weekday: number; opens: string | null; closes: string | null; hours_unknown: boolean }[],
	weekday: number,
	daylight: Win
): DayOpen {
	const r = rows.filter((x) => x.weekday === weekday);
	if (!r.length || r.some((x) => x.hours_unknown)) return { wins: [daylight], confirmed: false };
	const wins = r
		.filter((x) => x.opens && x.closes)
		.map((x) => [hm(x.opens!), hm(x.closes!)] as Win)
		.filter(([a, b]) => b > a);
	return wins.length ? { wins, confirmed: true } : null;
}

/**
 * Windows on `date` when the tide stays at or below `maxSafe` (P7-4), from that day's extremes with
 * cosine interpolation between consecutive high/low points. Outside the extremes = unknown = unsafe.
 */
export function tideSafeWindows(
	extremes: { time: string; height_m: number }[],
	date: string,
	maxSafe: number
): Win[] {
	const pts = extremes
		.map((e) => ({ t: istMinutes(e.time, date), h: e.height_m }))
		.sort((a, b) => a.t - b.t);
	const out: Win[] = [];
	let open: number | null = null;
	for (let i = 0; i < pts.length - 1; i++) {
		const a = pts[i]!;
		const b = pts[i + 1]!;
		for (let t = Math.max(a.t, 0); t <= Math.min(b.t, 1440); t += 5) {
			const h = a.h + ((b.h - a.h) * (1 - Math.cos((Math.PI * (t - a.t)) / (b.t - a.t)))) / 2;
			if (h <= maxSafe && open === null) open = t;
			if (h > maxSafe && open !== null) {
				out.push([open, t - 5]);
				open = null;
			}
		}
	}
	if (open !== null) out.push([open, Math.min(pts.at(-1)!.t, 1440)]);
	return out.filter(([a, b]) => b > a);
}

const LEVEL_SCORE = (level: number | null, isNew: boolean | null) =>
	level && !isNew ? level * 0.5 : 1;

export type PlannerParams = {
	days: number;
	startDate: string;
	start: Pt;
	interests: string[];
	standout: boolean;
	diet: Diet | null;
};

export async function loadPlannerData(db: DB, p: PlannerParams) {
	const dates = Array.from({ length: p.days }, (_, i) => addDays(p.startDate, i));
	let placesQ = db
		.from('places')
		.select(
			'id, category, location, taluka_id, is_hidden_gem, is_tide_dependent, tide_station_id, monsoon_status, visit_minutes, entry_fee_inr, place_hours(weekday, opens, closes, hours_unknown), crowd_typical(weekday, level), place_tide_rules(max_safe_height_m)'
		)
		.eq('status', 'published')
		.neq('monsoon_status', 'closed');
	if (p.interests.length)
		placesQ = placesQ.in(
			'category',
			p.interests as Database['public']['Enums']['place_category'][]
		);

	const [places, eateries, stays, cats, cfg, events, weather] = await Promise.all([
		placesQ,
		db
			.from('eateries')
			.select(
				'id, location, price_for_two, diet_flags, eatery_hours(weekday, opens, closes, hours_unknown)'
			)
			.eq('status', 'published'),
		db.from('stays').select('id, location, price_min').eq('status', 'published'),
		db.from('category_visit_minutes').select('category, minutes'),
		db
			.from('app_config')
			.select('key, value')
			.in('key', [
				'planner_day_start',
				'planner_daylight',
				'heavy_rain_mm_h',
				'fuel_price_inr',
				'default_mileage_kmpl'
			]),
		db
			.from('events_calendar')
			.select('taluka_id, from_date, to_date, impact')
			.lte('from_date', dates.at(-1)!.date)
			.gte('to_date', dates[0]!.date),
		p.startDate === istToday()
			? db
					.from('weather_cache')
					.select('point_id, summary, fetched_at, weather_points(location)')
					.gte('fetched_at', new Date(Date.now() - 3 * 3600e3).toISOString())
			: Promise.resolve({ data: [] as never[] })
	]);
	if (places.error || eateries.error || stays.error)
		throw places.error ?? eateries.error ?? stays.error;

	const conf = Object.fromEntries((cfg.data ?? []).map((r) => [r.key, r.value])) as Record<
		string,
		unknown
	>;
	const dl = (conf.planner_daylight ?? { from: '07:00', to: '18:30' }) as {
		from: string;
		to: string;
	};
	const daylight: Win = [hm(dl.from), hm(dl.to)];
	const dayStart = hm((conf.planner_day_start as string) ?? '09:00');
	const heavyRain = Number(conf.heavy_rain_mm_h ?? 7.6);
	const catMin = new Map((cats.data ?? []).map((c) => [c.category, c.minutes]));
	const ids = (places.data ?? []).map((x) => x.id);

	const [agg, alerted, tides] = await Promise.all([
		db
			.from('verdict_agg_all')
			.select('entity_id, winner_level, is_new')
			.eq('entity_type', 'place')
			.in('entity_id', ids),
		ids.length
			? db.rpc('planner_alerted_places', { _ids: ids })
			: Promise.resolve({ data: [] as string[] }),
		db
			.from('tide_cache')
			.select('station_id, date, extremes')
			.in(
				'date',
				dates.map((d) => d.date)
			)
	]);
	const verdict = new Map((agg.data ?? []).map((a) => [a.entity_id, a]));
	const blocked = new Set((alerted.data ?? []) as string[]);
	const tide = new Map(
		(tides.data ?? []).map((t) => [
			`${t.station_id}|${t.date}`,
			t.extremes as { time: string; height_m: number }[]
		])
	);

	// Heavy rain now (trip starting today only — OWM current weather, no forecast).
	const rainy = (weather.data ?? [])
		.filter(
			(w) => Number((w.summary as { rain_1h_mm?: number } | null)?.rain_1h_mm ?? 0) >= heavyRain
		)
		.map((w) => lonLat((w.weather_points as { location: unknown } | null)?.location))
		.filter((c): c is [number, number] => !!c);
	const nearRain = (pt: Pt) =>
		rainy.some(([lon, lat]) => Math.abs(lon - pt.lon) < 0.15 && Math.abs(lat - pt.lat) < 0.15);

	const festivalBusy = (taluka: string, date: string) =>
		(events.data ?? []).some(
			(e) =>
				e.from_date <= date &&
				e.to_date >= date &&
				(!e.taluka_id || e.taluka_id === taluka) &&
				(e.impact as { crowd?: string } | null)?.crowd === 'busy'
		);

	const needsTideCheck: string[] = [];
	const placeCands: PlaceCand[] = [];
	for (const x of places.data ?? []) {
		const c = lonLat(x.location);
		if (!c || blocked.has(x.id)) continue;
		const pt = { lon: c[0], lat: c[1] };
		const rule =
			(x.place_tide_rules as { max_safe_height_m: number | null } | null)?.max_safe_height_m ??
			null;
		const v = verdict.get(x.id);
		const days = dates.map(({ date, weekday }, d) => {
			let open = hoursOpen(x.place_hours, weekday, daylight);
			const reasons: string[] = [];
			if (open && x.is_tide_dependent) {
				const ex = x.tide_station_id ? tide.get(`${x.tide_station_id}|${date}`) : undefined;
				if (rule == null || !ex?.length) open = null;
				else {
					const wins = intersect(open.wins, tideSafeWindows(ex, date, Number(rule)));
					open = wins.length ? { ...open, wins } : null;
				}
			}
			const busy =
				festivalBusy(x.taluka_id, date) ||
				x.crowd_typical.some((ct) => ct.weekday === weekday && ct.level === 'busy');
			const calm =
				!busy && x.crowd_typical.some((ct) => ct.weekday === weekday && ct.level !== 'busy');
			let score = 1 + LEVEL_SCORE(v?.winner_level ?? null, v?.is_new ?? null);
			if (v?.winner_level === 4 && !v.is_new) reasons.push('top_rated');
			if (p.standout) {
				if (x.is_hidden_gem) {
					score += 2;
					reasons.push('hidden_gem');
				}
				if (calm) score += 1;
				if (busy) score -= 1.5;
			} else if (calm) score += 0.3;
			if (calm) reasons.push('low_crowd');
			if (festivalBusy(x.taluka_id, date)) reasons.push('festival');
			if (x.monsoon_status === 'risky') {
				score -= 0.5;
				reasons.push('monsoon_risky');
				if (d === 0 && (x.category === 'beach' || x.category === 'waterfall') && nearRain(pt)) {
					score -= 3;
					reasons.push('rain');
				}
			}
			return { open, score, reasons };
		});
		if (x.is_tide_dependent && days.every((d) => !d.open)) needsTideCheck.push(x.id);
		placeCands.push({
			id: x.id,
			...pt,
			category: x.category,
			visitMin: x.visit_minutes ?? catMin.get(x.category) ?? 60,
			fee: x.entry_fee_inr,
			tideDependent: x.is_tide_dependent,
			days
		});
	}

	const eateryCands: EateryCand[] = (eateries.data ?? [])
		.filter((e) => !p.diet || (e.diet_flags as Record<string, boolean>)?.[p.diet])
		.flatMap((e) => {
			const c = lonLat(e.location);
			if (!c) return [];
			return [
				{
					id: e.id,
					lon: c[0],
					lat: c[1],
					costPerPerson: e.price_for_two != null ? Math.round(e.price_for_two / 2) : null,
					// Meals run past daylight: unknown eatery hours → meal windows, labelled unconfirmed.
					days: dates.map(({ weekday }) => hoursOpen(e.eatery_hours, weekday, [11 * 60, 22 * 60]))
				}
			];
		});
	const stayCands: StayCand[] = (stays.data ?? []).flatMap((s) => {
		const c = lonLat(s.location);
		return c ? [{ id: s.id, lon: c[0], lat: c[1], price: s.price_min }] : [];
	});

	return {
		dates,
		dayStart,
		places: placeCands,
		eateries: eateryCands,
		stays: stayCands,
		needsTideCheck,
		fuelPrice: conf.fuel_price_inr != null ? Number(conf.fuel_price_inr) : null,
		mileage: conf.default_mileage_kmpl != null ? Number(conf.default_mileage_kmpl) : null
	};
}

/** Matrix-backed travel (corrected times); straight-line estimate for pairs not in the matrix. */
export async function travelFor(db: DB, ids: string[]): Promise<Travel> {
	const { data } = await db.rpc('planner_matrix', { _ids: ids });
	const m = new Map<string, [number, number]>();
	for (const [a, b, s, dist] of (data ?? []) as [string, string, number, number][])
		m.set(`${a}|${b}`, [s, dist]);
	return (from, to) => {
		const hit = from.id && to.id ? m.get(`${from.id}|${to.id}`) : undefined;
		return hit ? { s: hit[0], m: hit[1], estimated: false } : estimatedLeg(from, to);
	};
}
