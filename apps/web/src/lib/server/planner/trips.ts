// Trip persistence (BACKEND §3.9, §10): generate → save trip/stops/budget; edit → re-time + re-cost.
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/db.types.ts';
import { m } from '#lib/paraglide/messages.js';
import { msg } from '#lib/msg.ts';
import {
	estimate,
	gmapsLinks,
	plan,
	retime,
	LUNCH,
	DINNER,
	type Pace,
	type Pt,
	type Stop
} from '#lib/planner/engine.ts';
import { lonLat, tr, type Lang } from '../listings.ts';
import { addDays, istToday, loadPlannerData, travelFor, type Diet } from './data.ts';

type DB = SupabaseClient<Database>;
type Kind = 'place' | 'stay' | 'eatery';
/** Guest voter id (group vote, no login); random, never linked to an account. */
export const VOTER_COOKIE = 'cw_voter';
const LANGS = ['en', 'hi', 'mr'] as const;

export const planInput = z.object({
	days: z.coerce.number().int().min(1).max(7),
	start_date: z.iso.date(),
	start: z.object({ label: z.string().trim().min(1).max(120), lon: z.number(), lat: z.number() }),
	group_type: z.enum(['family', 'couple', 'solo', 'friends']),
	people: z.coerce.number().int().min(1).max(50),
	budget: z.coerce.number().int().min(0).max(10_000_000).nullable(),
	interests: z
		.array(
			z.enum([
				'beach',
				'fort',
				'temple',
				'waterfall',
				'viewpoint',
				'backwater',
				'cave',
				'museum',
				'village',
				'market',
				'orchard'
			])
		)
		.max(11),
	pace: z.enum(['relaxed', 'balanced', 'packed']),
	standout: z.boolean(),
	diet: z.enum(['veg', 'non_veg', 'jain']).nullable()
});
export type PlanInput = z.infer<typeof planInput>;

const at = (date: string, minutes: number) => {
	const h = String(Math.floor(minutes / 60)).padStart(2, '0');
	const mm = String(minutes % 60).padStart(2, '0');
	return `${date}T${h}:${mm}:00+05:30`;
};

/** Reason codes → short text per language (template; Crabby may rephrase in P8). */
export function reasonText(codes: string[]) {
	return Object.fromEntries(
		LANGS.map((l) => [
			l,
			codes.length ? codes.map((c) => msg(`reason_${c}`, {}, l)).join(' · ') : null
		])
	) as Record<Lang, string | null>;
}

const entityOf = (s: { kind: Stop['kind']; id: string }, kinds: Map<string, Kind>) =>
	s.kind === 'place' ? 'place' : s.kind === 'stay' ? 'stay' : (kinds.get(s.id) ?? 'eatery');

/** Runs the planner without saving (Crabby previews reuse this; createTrip saves the same result). */
export async function computeTrip(db: DB, p: PlanInput) {
	const data = await loadPlannerData(db, {
		days: p.days,
		startDate: p.start_date,
		start: p.start,
		interests: p.interests,
		standout: p.standout,
		diet: p.diet as Diet | null
	});
	const travel = await travelFor(db, [
		...data.places.map((x) => x.id),
		...data.eateries.map((x) => x.id),
		...data.stays.map((x) => x.id)
	]);
	const days = plan({
		days: p.days,
		start: p.start,
		dayStart: data.dayStart,
		pace: p.pace as Pace,
		budget: p.budget,
		places: data.places,
		eateries: data.eateries,
		stays: data.stays,
		travel
	});
	return { data, days };
}

export async function createTrip(db: DB, ownerId: string, p: PlanInput) {
	const { data, days } = await computeTrip(db, p);
	const { data: trip, error } = await db
		.from('trips')
		.insert({
			owner_id: ownerId,
			title: m.plan_default_title({ days: p.days, from: p.start.label }),
			days: p.days,
			start_date: p.start_date,
			start_point: p.start,
			budget: p.budget,
			group_type: p.group_type,
			interests: p.interests,
			pace: p.pace,
			standout: p.standout,
			diet: p.diet
		})
		.select('id')
		.single();
	if (error) throw error;

	const rows = days.flatMap((d, i) =>
		d.stops.map((s, order) => ({
			trip_id: trip.id,
			day: i + 1,
			order,
			kind: s.kind,
			entity_type: (s.kind === 'meal' ? 'eatery' : s.kind) as Kind,
			entity_id: s.id,
			arrive_at: at(data.dates[i]!.date, s.arrive),
			depart_at: at(data.dates[i]!.date, s.depart),
			travel_from_prev_s: s.travel.s,
			...Object.fromEntries(
				Object.entries(reasonText(s.reasons)).map(([l, t]) => [`reason_${l}`, t])
			)
		}))
	);
	if (rows.length) {
		const { error: e2 } = await db.from('trip_stops').insert(rows);
		if (e2) throw e2;
	}
	const km = days.flatMap((d) => d.stops).reduce((s, x) => s + x.travel.m, 0) / 1000;
	const b = estimate({
		people: p.people,
		stayPrices: rows
			.filter((r) => r.kind === 'stay')
			.map((r) => data.stays.find((s) => s.id === r.entity_id)?.price ?? null),
		mealCosts: rows
			.filter((r) => r.kind === 'meal')
			.map((r) => data.eateries.find((e) => e.id === r.entity_id)?.costPerPerson ?? null),
		fees: rows
			.filter((r) => r.kind === 'place')
			.map((r) => data.places.find((x) => x.id === r.entity_id)?.fee ?? null),
		km,
		fuelPrice: data.fuelPrice,
		mileage: data.mileage,
		activities: 0
	});
	const { error: e3 } = await db.from('trip_budget').insert({
		trip_id: trip.id,
		stay: b.stay,
		food: b.food,
		fuel: b.fuel ?? 0,
		entry: b.entry,
		activities: 0,
		people: p.people,
		fuel_price: data.fuelPrice,
		vehicle_mileage_kmpl: data.mileage
	});
	if (e3) throw e3;
	return { id: trip.id, needsTideCheck: data.needsTideCheck.length };
}

type StopRow = Database['public']['Tables']['trip_stops']['Row'];

/** Names, links and coordinates for stops (published listings only, via RLS). */
export async function describeStops(
	db: DB,
	stops: Pick<StopRow, 'entity_type' | 'entity_id'>[],
	lang: Lang
) {
	const ids = (t: Kind) => [
		...new Set(stops.filter((s) => s.entity_type === t).map((s) => s.entity_id))
	];
	const [p, s, e] = await Promise.all([
		db
			.from('places')
			.select('id, slug, category, location, entry_fee_inr, place_translations(lang, name)')
			.in('id', ids('place')),
		db
			.from('stays')
			.select('id, slug, location, price_min, stay_translations(lang, name)')
			.in('id', ids('stay')),
		db
			.from('eateries')
			.select('id, slug, location, price_for_two, eatery_translations(lang, name)')
			.in('id', ids('eatery'))
	]);
	const out = new Map<
		string,
		{ name: string; href: string; pt: Pt | null; category?: string; cost: number | null }
	>();
	const pt = (l: unknown) => {
		const c = lonLat(l);
		return c ? { lon: c[0], lat: c[1] } : null;
	};
	for (const x of p.data ?? [])
		out.set(x.id, {
			name: tr(x.place_translations, lang) ?? x.slug,
			href: `/place/${x.slug}`,
			pt: pt(x.location),
			category: x.category,
			cost: x.entry_fee_inr
		});
	for (const x of s.data ?? [])
		out.set(x.id, {
			name: tr(x.stay_translations, lang) ?? x.slug,
			href: `/stays/${x.slug}`,
			pt: pt(x.location),
			cost: x.price_min
		});
	for (const x of e.data ?? [])
		out.set(x.id, {
			name: tr(x.eatery_translations, lang) ?? x.slug,
			href: `/food/${x.slug}`,
			pt: pt(x.location),
			cost: x.price_for_two != null ? Math.round(x.price_for_two / 2) : null
		});
	return out;
}

export const editInput = z.object({
	title: z.string().trim().min(1).max(120).optional(),
	status: z.enum(['draft', 'saved', 'completed']).optional(),
	start_date: z.iso.date().optional(),
	budget: z
		.object({
			people: z.number().int().min(1).max(50),
			fuel_price: z.number().min(0).max(1000).nullable(),
			vehicle_mileage_kmpl: z.number().min(1).max(100).nullable(),
			activities: z.number().int().min(0).max(10_000_000)
		})
		.optional(),
	days: z
		.array(
			z.array(z.object({ kind: z.enum(['place', 'meal', 'stay']), entity_id: z.uuid() })).max(30)
		)
		.max(7)
		.optional()
});

/**
 * Apply an edit (reorder/add/remove stops, budget inputs) and re-time + re-cost from the matrix.
 * Stops moved outside their hours stay but are flagged (`conflict`), never silently dropped.
 */
export async function editTrip(db: DB, id: string, e: z.infer<typeof editInput>) {
	const { data: trip } = await db
		.from('trips')
		.select('*, trip_stops(*), trip_budget(*)')
		.eq('id', id)
		.maybeSingle();
	if (!trip) return null;
	const patch: Database['public']['Tables']['trips']['Update'] = {};
	if (e.title) patch.title = e.title;
	if (e.status) patch.status = e.status;
	if (e.start_date) patch.start_date = e.start_date;
	if (Object.keys(patch).length) {
		const { error } = await db.from('trips').update(patch).eq('id', id);
		if (error) throw error;
	}
	const startDate =
		e.start_date ?? trip.start_date ?? addDays(new Date().toISOString().slice(0, 10), 1).date;
	const order =
		e.days ??
		(e.start_date
			? Array.from({ length: trip.days }, (_, d) =>
					trip.trip_stops
						.filter((s) => s.day === d + 1)
						.sort((a, b) => a.order - b.order)
						.map((s) => ({ kind: s.kind, entity_id: s.entity_id }))
				)
			: null);
	if (order) await retimeTrip(db, trip, order, startDate);
	const tb = Array.isArray(trip.trip_budget) ? trip.trip_budget[0] : trip.trip_budget;
	await recost(
		db,
		id,
		e.budget ??
			(tb
				? {
						people: tb.people,
						fuel_price: tb.fuel_price,
						vehicle_mileage_kmpl: tb.vehicle_mileage_kmpl,
						activities: tb.activities
					}
				: undefined)
	);
	return true;
}

async function retimeTrip(
	db: DB,
	trip: {
		id: string;
		days: number;
		start_point: unknown;
		interests: string[];
		standout: boolean;
		diet: string | null;
	},
	order: { kind: Stop['kind']; entity_id: string }[][],
	startDate: string
) {
	const start = trip.start_point as Pt;
	const data = await loadPlannerData(db, {
		days: trip.days,
		startDate,
		start,
		interests: [],
		standout: trip.standout,
		diet: null
	});
	const all = order.flat();
	const travel = await travelFor(
		db,
		all.map((s) => s.entity_id)
	);
	const kinds = new Map<string, Kind>(
		all.map((s) => [s.entity_id, s.kind === 'meal' ? 'eatery' : s.kind])
	);
	const info = await describeStops(
		db,
		all.map((s) => ({ entity_type: kinds.get(s.entity_id)!, entity_id: s.entity_id })),
		'en'
	);
	const rows: Database['public']['Tables']['trip_stops']['Insert'][] = [];
	let pos: Pt = start;
	for (let d = 0; d < Math.min(order.length, trip.days); d++) {
		const seq = order[d]!.filter((s) => info.get(s.entity_id)?.pt).map((s) => {
			const place = data.places.find((x) => x.id === s.entity_id);
			const eat = data.eateries.find((x) => x.id === s.entity_id);
			return {
				kind: s.kind,
				id: s.entity_id,
				pt: info.get(s.entity_id)!.pt!,
				minutes:
					s.kind === 'place' ? (place?.visitMin ?? 60) : s.kind === 'meal' ? LUNCH.minutes : 0,
				open:
					s.kind === 'place'
						? (place?.days[d]?.open ?? null)
						: s.kind === 'meal'
							? (eat?.days[d] ?? { wins: [[LUNCH.from, DINNER.to]], confirmed: false })
							: null
			};
		});
		const timed = retime(seq, pos, data.dayStart, travel);
		const date = data.dates[d]!.date;
		timed.forEach((t, i) => {
			const place = data.places.find((x) => x.id === t.id);
			const codes = t.kind === 'place' ? [...(place?.days[d]?.reasons ?? [])] : [];
			if (t.conflict) codes.unshift('closed_then');
			rows.push({
				trip_id: trip.id,
				day: d + 1,
				order: i,
				kind: t.kind,
				entity_type: entityOf(t, kinds),
				entity_id: t.id,
				arrive_at: at(date, t.arrive),
				depart_at: at(date, t.depart),
				travel_from_prev_s: t.travel.s,
				...Object.fromEntries(Object.entries(reasonText(codes)).map(([l, x]) => [`reason_${l}`, x]))
			});
		});
		pos = timed.at(-1)?.pt ?? pos;
	}
	const del = await db.from('trip_stops').delete().eq('trip_id', trip.id);
	if (del.error) throw del.error;
	if (rows.length) {
		const { error } = await db.from('trip_stops').insert(rows);
		if (error) throw error;
	}
}

async function recost(
	db: DB,
	id: string,
	b?: {
		people: number;
		fuel_price: number | null;
		vehicle_mileage_kmpl: number | null;
		activities: number;
	}
) {
	if (!b) return;
	const [{ data: trip }, { data: stops }] = await Promise.all([
		db.from('trips').select('start_point').eq('id', id).single(),
		db
			.from('trip_stops')
			.select('day, order, kind, entity_type, entity_id')
			.eq('trip_id', id)
			.order('day')
			.order('order')
	]);
	const list = stops ?? [];
	const info = await describeStops(db, list, 'en');
	const travel = await travelFor(
		db,
		list.map((s) => s.entity_id)
	);
	let from: Pt & { id?: string } = trip?.start_point as Pt;
	let meters = 0;
	for (const s of list) {
		const to = info.get(s.entity_id)?.pt;
		if (!to) continue;
		meters += travel(from, { ...to, id: s.entity_id }).m;
		from = { ...to, id: s.entity_id };
	}
	const cost = (k: string) =>
		list.filter((s) => s.kind === k).map((s) => info.get(s.entity_id)?.cost ?? null);
	const est = estimate({
		people: b.people,
		stayPrices: cost('stay'),
		mealCosts: cost('meal'),
		fees: cost('place'),
		km: meters / 1000,
		fuelPrice: b.fuel_price,
		mileage: b.vehicle_mileage_kmpl,
		activities: b.activities
	});
	const { error } = await db.from('trip_budget').upsert(
		{
			trip_id: id,
			stay: est.stay,
			food: est.food,
			fuel: est.fuel ?? 0,
			entry: est.entry,
			activities: est.activities,
			people: b.people,
			fuel_price: b.fuel_price,
			vehicle_mileage_kmpl: b.vehicle_mileage_kmpl
		},
		{ onConflict: 'trip_id' }
	);
	if (error) throw error;
	return est;
}

/** One Google Maps link set per day (≤ 10 points each), starting from the day's start point. */
export function dayLinks(start: Pt, days: { pts: Pt[] }[]) {
	let from = start;
	return days.map((d) => {
		const links = d.pts.length ? gmapsLinks([from, ...d.pts]) : [];
		from = d.pts.at(-1) ?? from;
		return links;
	});
}

type TripRow = Database['public']['Tables']['trips']['Row'];
type BudgetRow = Database['public']['Tables']['trip_budget']['Row'];

const hhmm = (iso: string | null) =>
	iso
		? new Intl.DateTimeFormat('en-GB', {
				hour: '2-digit',
				minute: '2-digit',
				timeZone: 'Asia/Kolkata'
			}).format(new Date(iso))
		: null;

/** Everything the plan view needs: day tabs, timeline, Maps links, budget (owner, share, itinerary). */
export async function tripView(
	db: DB,
	trip: Omit<TripRow, 'owner_id' | 'share_token'> & { share_token?: string | null },
	stops: StopRow[],
	budget: BudgetRow | null,
	lang: Lang
) {
	const info = await describeStops(db, stops, lang);
	const sorted = [...stops].sort((a, b) => a.day - b.day || a.order - b.order);
	const days = Array.from({ length: trip.days }, (_, d) => {
		const list = sorted.filter((s) => s.day === d + 1);
		return {
			date: trip.start_date ? addDays(trip.start_date, d).date : null,
			stops: list.map((s) => {
				const i = info.get(s.entity_id);
				return {
					id: s.id,
					kind: s.kind,
					entity_type: s.entity_type,
					entity_id: s.entity_id,
					name: i?.name ?? null,
					href: i?.href ?? null,
					arrive: hhmm(s.arrive_at),
					depart: hhmm(s.depart_at),
					travelMin: s.travel_from_prev_s != null ? Math.round(s.travel_from_prev_s / 60) : null,
					reason: (s[`reason_${lang}` as const] ?? s.reason_en) || null
				};
			}),
			pts: list.map((s) => info.get(s.entity_id)?.pt).filter((p): p is Pt => !!p)
		};
	});
	const start = trip.start_point as (Pt & { label: string }) | null;
	const links = start ? dayLinks(start, days) : days.map(() => []);
	const total = budget
		? budget.stay + budget.food + budget.fuel + budget.entry + budget.activities
		: null;
	return {
		trip: {
			id: trip.id,
			title: trip.title,
			days: trip.days,
			start_date: trip.start_date,
			start: start?.label ?? null,
			pace: trip.pace,
			group_type: trip.group_type,
			status: trip.status,
			is_ready_made: trip.is_ready_made,
			slug: trip.slug
		},
		days: days.map((d, i) => ({ date: d.date, stops: d.stops, links: links[i] ?? [] })),
		budget: budget
			? {
					...budget,
					total: total!,
					perPerson: Math.round(total! / Math.max(1, budget.people)),
					fuelMissing: !budget.fuel_price || !budget.vehicle_mileage_kmpl,
					entryUnknown: stops.filter(
						(s) => s.kind === 'place' && info.get(s.entity_id)?.cost == null
					).length
				}
			: null
	};
}

/**
 * Navigation legs for a trip (PLAN P9 task 1): start point / previous stop → each stop, with the stored OSRM
 * shape + turn cues when the matrix has the pair. Legs without a shape (first leg from a station, > 60 km)
 * navigate with a straight guide line and the "Open in Google Maps" hand-off.
 */
export async function tripRoutes(db: DB, tripId: string, lang: Lang) {
	const { data: t } = await db
		.from('trips')
		.select(
			'id, title, days, start_point, trip_stops(day, order, kind, entity_type, entity_id, arrive_at)'
		)
		.eq('id', tripId)
		.maybeSingle();
	if (!t) return null;
	const info = await describeStops(db, t.trip_stops, lang);
	const start = t.start_point as (Pt & { label: string }) | null;
	let from: { id: string | null; name: string; pt: Pt | null } = {
		id: null,
		name: start?.label ?? '',
		pt: start
	};
	const days = [];
	for (let d = 1; d <= t.days; d++) {
		const stops = t.trip_stops.filter((s) => s.day === d).sort((a, b) => a.order - b.order);
		const legs = [];
		for (const s of stops) {
			const to = info.get(s.entity_id);
			if (!to?.pt) continue;
			const leg = from.id
				? ((await db.rpc('nav_leg', { _from: from.id, _to: s.entity_id })).data?.[0] ?? null)
				: null;
			legs.push({
				from: { name: from.name, at: from.pt ? [from.pt.lon, from.pt.lat] : null },
				to: {
					name: to.name,
					at: [to.pt.lon, to.pt.lat],
					kind: s.kind,
					href: to.href,
					arrive_at: s.arrive_at
				},
				shape: leg?.shape ?? null,
				turns: leg?.turns ?? null,
				distance_m: leg?.distance_m ?? null,
				duration_s: leg?.duration_s ?? null
			});
			from = { id: s.entity_id, name: to.name, pt: to.pt };
		}
		days.push({ day: d, legs });
	}
	return { id: t.id, title: t.title, days };
}

/**
 * Better stop order for one day (BACKEND §10.6, reuses 2-opt): reorders the day's places among themselves
 * (meals and the stay keep their slots), re-timed against hours/tides from the matrix. Suggested only if it
 * saves ≥ 5 min of driving without adding any stop outside its hours.
 */
export async function suggestOrder(db: DB, tripId: string, day: number) {
	const { data: t } = await db
		.from('trips')
		.select(
			'days, start_date, start_point, standout, trip_stops(day, order, kind, entity_type, entity_id)'
		)
		.eq('id', tripId)
		.maybeSingle();
	if (!t || day < 1 || day > t.days) return null;
	const byDay = (d: number) =>
		t.trip_stops.filter((s) => s.day === d).sort((a, b) => a.order - b.order);
	const stops = byDay(day);
	const info = await describeStops(db, t.trip_stops, 'en');
	const prev = day > 1 ? byDay(day - 1).at(-1) : undefined;
	const start = (prev && info.get(prev.entity_id)?.pt) || (t.start_point as Pt);
	const data = await loadPlannerData(db, {
		days: t.days,
		startDate: t.start_date ?? addDays(istToday(), 1).date,
		start,
		interests: [],
		standout: t.standout,
		diet: null
	});
	const travel = await travelFor(db, [
		...(prev ? [prev.entity_id] : []),
		...stops.map((s) => s.entity_id)
	]);
	const seqOf = (order: typeof stops) =>
		order
			.filter((s) => info.get(s.entity_id)?.pt)
			.map((s) => {
				const place = data.places.find((x) => x.id === s.entity_id);
				return {
					kind: s.kind,
					id: s.entity_id,
					pt: info.get(s.entity_id)!.pt!,
					minutes:
						s.kind === 'place' ? (place?.visitMin ?? 60) : s.kind === 'meal' ? LUNCH.minutes : 0,
					open: s.kind === 'place' ? (place?.days[day - 1]?.open ?? null) : null
				};
			});
	const score = (order: typeof stops) => {
		const r = retime(seqOf(order), start, data.dayStart, travel);
		return {
			s: r.reduce((a, x) => a + x.travel.s, 0),
			conflicts: r.filter((x) => x.kind === 'place' && x.conflict).length
		};
	};
	const slots = stops.map((s, i) => (s.kind === 'place' ? i : -1)).filter((i) => i >= 0);
	const withPlaces = (places: typeof stops) =>
		stops.map((s, i) => (s.kind === 'place' ? places[slots.indexOf(i)]! : s));
	let places = slots.map((i) => stops[i]!);
	const base = score(stops);
	let best = base;
	let improved = true;
	while (improved) {
		improved = false;
		for (let i = 0; i < places.length - 1; i++)
			for (let k = i + 1; k < places.length; k++) {
				const cand = [
					...places.slice(0, i),
					...places.slice(i, k + 1).reverse(),
					...places.slice(k + 1)
				];
				const sc = score(withPlaces(cand));
				if (sc.conflicts <= base.conflicts && sc.s < best.s) {
					places = cand;
					best = sc;
					improved = true;
				}
			}
	}
	const savedMin = Math.round((base.s - best.s) / 60);
	if (savedMin < 5) return { savedMin: 0, days: null };
	const days = Array.from({ length: t.days }, (_, d) =>
		(d + 1 === day ? withPlaces(places) : byDay(d + 1)).map((s) => ({
			kind: s.kind,
			entity_id: s.entity_id
		}))
	);
	return { savedMin, days, names: places.map((p) => info.get(p.entity_id)?.name ?? '') };
}
