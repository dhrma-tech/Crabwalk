// Deterministic trip planner (BACKEND §10.2 [DEFAULT algorithm]). Pure: the data layer
// (lib/server/planner/data.ts) resolves hours, tides, weather, crowd and festivals into per-day
// windows and scores; this module only schedules. Times are minutes after midnight IST.

export type Pace = 'relaxed' | 'balanced' | 'packed';
export const PACE_HOURS: Record<Pace, number> = { relaxed: 6, balanced: 8, packed: 10 }; // P7-1
export const LUNCH = { from: 12 * 60 + 30, to: 14 * 60 + 30, minutes: 60 }; // P7-7
export const DINNER = { from: 19 * 60 + 30, to: 21 * 60, minutes: 60 };
export const MAX_GMAPS_POINTS = 10;

export type Win = [number, number];
export type Pt = { lon: number; lat: number };
export type Leg = { s: number; m: number; estimated: boolean };
export type Travel = (from: Pt & { id?: string }, to: Pt & { id?: string }) => Leg;

/** A day's opening: windows already intersected with hours/daylight/tide; confirmed = real hours. */
export type DayOpen = { wins: Win[]; confirmed: boolean } | null;

export type PlaceCand = Pt & {
	id: string;
	category: string;
	visitMin: number;
	fee: number | null;
	tideDependent: boolean;
	/** per trip day: score (higher = better) and reason codes; null open = not plannable that day */
	days: { open: DayOpen; score: number; reasons: string[] }[];
};
export type EateryCand = Pt & { id: string; costPerPerson: number | null; days: DayOpen[] };
export type StayCand = Pt & { id: string; price: number | null };

export type Stop = {
	kind: 'place' | 'meal' | 'stay';
	id: string;
	arrive: number;
	depart: number;
	travel: Leg;
	reasons: string[];
};
export type PlanDay = { stops: Stop[]; end: Pt };

export type PlanInput = {
	days: number;
	start: Pt;
	dayStart: number;
	pace: Pace;
	budget: number | null;
	places: PlaceCand[];
	eateries: EateryCand[];
	stays: StayCand[];
	travel: Travel;
};

const fits = (open: DayOpen, from: number, minutes: number): number | null => {
	if (!open) return null;
	for (const [a, b] of open.wins) {
		const arrive = Math.max(from, a);
		if (arrive + minutes <= b) return arrive;
	}
	return null;
};

type Item = { kind: 'place'; c: PlaceCand } | { kind: 'meal'; e: EateryCand };

/** Walk a sequence from a start point/time; null when any stop misses its window or the day end. */
function simulate(
	seq: Item[],
	day: number,
	start: Pt,
	t0: number,
	end: number,
	travel: Travel
): Stop[] | null {
	const out: Stop[] = [];
	let pos: Pt & { id?: string } = start;
	let t = t0;
	for (const it of seq) {
		const to = it.kind === 'place' ? it.c : it.e;
		const leg = travel(pos, to);
		const ready = t + Math.round(leg.s / 60);
		let arrive: number | null;
		let minutes: number;
		if (it.kind === 'place') {
			minutes = it.c.visitMin;
			arrive = fits(it.c.days[day]?.open ?? null, ready, minutes);
			if (arrive === null || arrive + minutes > end) return null;
		} else {
			minutes = LUNCH.minutes;
			const meal = ready <= DINNER.from - 120 ? LUNCH : DINNER;
			arrive = fits(it.e.days[day] ?? null, Math.max(ready, meal.from), minutes);
			if (arrive === null || arrive > meal.to - minutes) return null;
		}
		out.push({
			kind: it.kind,
			id: to.id,
			arrive,
			depart: arrive + minutes,
			travel: leg,
			reasons:
				it.kind === 'place'
					? reasonsFor(it.c, day, arrive)
					: it.e.days[day]?.confirmed === false
						? ['hours_unconfirmed']
						: []
		});
		pos = to;
		t = arrive + minutes;
	}
	return out;
}

function reasonsFor(c: PlaceCand, day: number, arrive: number) {
	const r = [...(c.days[day]?.reasons ?? [])];
	if ((c.category === 'beach' || c.category === 'viewpoint') && arrive >= 16 * 60 + 45)
		r.push('sunset');
	if (c.tideDependent) r.push('tide_safe');
	if (c.days[day]?.open && !c.days[day]!.open!.confirmed) r.push('hours_unconfirmed');
	return r;
}

const travelTotal = (stops: Stop[]) => stops.reduce((s, x) => s + x.travel.s, 0);
const hasMeal = (stops: Stop[] | null) => !!stops?.some((x) => x.kind === 'meal');

/** Lunch goes in at the first gap after 12:30 (or the nearest eatery that still fits). */
function withLunch(
	places: PlaceCand[],
	day: number,
	start: Pt,
	t0: number,
	end: number,
	inp: PlanInput
): Stop[] | null {
	const plain = places.map((c) => ({ kind: 'place', c }) as Item);
	// Try lunch in every gap (nearest eateries first); keep the schedule that ends the day earliest.
	let best: Stop[] | null = null;
	for (let i = 0; i <= plain.length; i++) {
		const at: Pt & { id?: string } = i ? places[i - 1]! : start;
		const eats = [...inp.eateries]
			.map((e) => ({ e, s: inp.travel(at, e).s }))
			.filter((x) => x.s <= 30 * 60)
			.sort((a, b) => a.s - b.s || a.e.id.localeCompare(b.e.id));
		for (const { e } of eats) {
			const seq = [...plain.slice(0, i), { kind: 'meal', e } as Item, ...plain.slice(i)];
			const r = simulate(seq, day, start, t0, end + LUNCH.minutes, inp.travel);
			if (!r) continue;
			const better =
				!best ||
				r.at(-1)!.depart < best.at(-1)!.depart ||
				(r.at(-1)!.depart === best.at(-1)!.depart && travelTotal(r) < travelTotal(best));
			if (better) best = r;
			break; // nearest feasible eatery for this gap
		}
	}
	return best ?? simulate(plain, day, start, t0, end, inp.travel);
}

/** 2-opt over the place order (lunch re-inserted each time); keep only feasible, shorter orders. */
function twoOpt(order: PlaceCand[], build: (o: PlaceCand[]) => Stop[] | null) {
	let best = order;
	let bestStops = build(best);
	if (!bestStops) return { order, stops: null };
	let improved = true;
	while (improved) {
		improved = false;
		for (let i = 0; i < best.length - 1; i++)
			for (let k = i + 1; k < best.length; k++) {
				const cand = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)];
				const s = build(cand);
				// Shorter and still feasible; never trade lunch away for distance.
				if (s && hasMeal(s) >= hasMeal(bestStops) && travelTotal(s) < travelTotal(bestStops!)) {
					best = cand;
					bestStops = s;
					improved = true;
				}
			}
	}
	return { order: best, stops: bestStops };
}

export function plan(inp: PlanInput): PlanDay[] {
	const used = new Set<string>();
	const out: PlanDay[] = [];
	const nights = inp.days - 1;
	const nightCap = inp.budget && nights > 0 ? (inp.budget * 0.4) / nights : null;
	let pos: Pt & { id?: string } = inp.start;

	for (let d = 0; d < inp.days; d++) {
		const t0 = inp.dayStart;
		const end = t0 + PACE_HOURS[inp.pace] * 60;
		const chosen: PlaceCand[] = [];
		const build = (o: PlaceCand[]) => withLunch(o, d, pos, t0, end, inp);

		// Greedy insertion: best score per travel cost that keeps the whole day feasible.
		// Once the day has a lunch stop, a new place may not push lunch out of its window.
		let current: Stop[] | null = null;
		for (;;) {
			const last: Pt & { id?: string } = chosen.at(-1) ?? pos;
			let best: { c: PlaceCand; u: number; stops: Stop[] } | null = null;
			for (const c of inp.places) {
				if (used.has(c.id) || !c.days[d]?.open) continue;
				const u = c.days[d]!.score - inp.travel(last, c).s / 1800;
				if (best && u <= best.u) continue;
				const stops = build([...chosen, c]);
				if (stops && hasMeal(stops) >= hasMeal(current)) best = { c, u, stops };
			}
			if (!best) break;
			chosen.push(best.c);
			used.add(best.c.id);
			current = best.stops;
		}
		const { stops } = twoOpt(chosen, build);
		const day: Stop[] = stops ?? [];

		// Dinner near the last stop, then the night's stay (not after the last day).
		const tail: Pt & { id?: string } = (day.at(-1) && findPt(inp, day.at(-1)!)) || pos;
		const tEnd = day.at(-1)?.depart ?? t0;
		const dinner = [...inp.eateries]
			.filter((e) => !day.some((s) => s.id === e.id))
			.map((e) => ({ e, leg: inp.travel(tail, e) }))
			.filter((x) => x.leg.s <= 30 * 60)
			.sort((a, b) => a.leg.s - b.leg.s || a.e.id.localeCompare(b.e.id))
			.map(({ e, leg }) => {
				const arrive = fits(
					e.days[d] ?? null,
					Math.max(tEnd + Math.round(leg.s / 60), DINNER.from),
					DINNER.minutes
				);
				return arrive !== null && arrive <= DINNER.to - DINNER.minutes ? { e, leg, arrive } : null;
			})
			.find(Boolean);
		let here: Pt & { id?: string } = tail;
		let t = tEnd;
		if (dinner) {
			day.push({
				kind: 'meal',
				id: dinner.e.id,
				arrive: dinner.arrive,
				depart: dinner.arrive + DINNER.minutes,
				travel: dinner.leg,
				reasons: dinner.e.days[d]?.confirmed === false ? ['hours_unconfirmed'] : []
			});
			here = dinner.e;
			t = dinner.arrive + DINNER.minutes;
		}
		if (d < inp.days - 1 && inp.stays.length) {
			const stay = [...inp.stays]
				.map((s) => ({ s, leg: inp.travel(here, s) }))
				.sort(
					(a, b) =>
						rank(a.s, nightCap) - rank(b.s, nightCap) ||
						a.leg.s - b.leg.s ||
						a.s.id.localeCompare(b.s.id)
				)[0]!;
			const arrive = t + Math.round(stay.leg.s / 60);
			day.push({
				kind: 'stay',
				id: stay.s.id,
				arrive,
				depart: arrive,
				travel: stay.leg,
				reasons: []
			});
			here = stay.s;
		}
		out.push({ stops: day, end: { lon: here.lon, lat: here.lat } });
		pos = here;
	}
	return out;
}

// Stays that fit the nightly cap first, then unknown price, then over budget.
const rank = (s: StayCand, cap: number | null) =>
	s.price == null ? 1 : cap == null || s.price <= cap ? 0 : 2;

function findPt(inp: PlanInput, s: Stop): (Pt & { id: string }) | undefined {
	return (
		inp.places.find((p) => p.id === s.id) ??
		inp.eateries.find((e) => e.id === s.id) ??
		inp.stays.find((x) => x.id === s.id)
	);
}

/** Re-time an edited day (user reorder/add). Conflicts are flagged, not dropped. */
export function retime(
	seq: { kind: Stop['kind']; id: string; pt: Pt; minutes: number; open: DayOpen }[],
	start: Pt,
	dayStart: number,
	travel: Travel
) {
	let pos: Pt & { id?: string } = start;
	let t = dayStart;
	return seq.map((x) => {
		const leg = travel(pos, { ...x.pt, id: x.id });
		const ready = t + Math.round(leg.s / 60);
		const fit = x.kind === 'stay' ? ready : fits(x.open, ready, x.minutes);
		const arrive = fit ?? ready;
		pos = { ...x.pt, id: x.id };
		t = arrive + x.minutes;
		return { ...x, arrive, depart: t, travel: leg, conflict: fit === null };
	});
}

/** Google Maps directions links: ≤ 10 points per link; consecutive links share the joint point. */
export function gmapsLinks(points: Pt[]) {
	const links: string[] = [];
	const ll = (p: Pt) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
	for (let i = 0; i < points.length - 1; i += MAX_GMAPS_POINTS - 1) {
		const chunk = points.slice(i, i + MAX_GMAPS_POINTS);
		const q = new URLSearchParams({
			api: '1',
			origin: ll(chunk[0]!),
			destination: ll(chunk.at(-1)!),
			travelmode: 'driving'
		});
		if (chunk.length > 2) q.set('waypoints', chunk.slice(1, -1).map(ll).join('|'));
		links.push(`https://www.google.com/maps/dir/?${q}`);
	}
	return links;
}

export type Budget = {
	stay: number;
	food: number;
	fuel: number | null;
	entry: number;
	entryUnknown: number;
	activities: number;
	total: number;
	perPerson: number;
};

/** BACKEND §10.3. Fuel stays null until a price and mileage exist (P7-6: no invented price). */
export function estimate(b: {
	people: number;
	stayPrices: (number | null)[];
	mealCosts: (number | null)[];
	fees: (number | null)[];
	km: number;
	fuelPrice: number | null;
	mileage: number | null;
	activities: number;
}): Budget {
	const stay = b.stayPrices.reduce<number>((s, p) => s + (p ?? 0), 0);
	const food = b.mealCosts.reduce<number>((s, c) => s + (c ?? 0) * b.people, 0);
	const fuel = b.fuelPrice && b.mileage ? Math.round((b.km / b.mileage) * b.fuelPrice) : null;
	const entry = b.fees.reduce<number>((s, f) => s + (f ?? 0) * b.people, 0);
	const total = stay + food + (fuel ?? 0) + entry + b.activities;
	return {
		stay,
		food,
		fuel,
		entry,
		entryUnknown: b.fees.filter((f) => f == null).length,
		activities: b.activities,
		total,
		perPerson: Math.round(total / Math.max(1, b.people))
	};
}

/** Straight-line fallback for legs not in the travel matrix (start point, new listings). */
export function estimatedLeg(a: Pt, b: Pt): Leg {
	const km =
		Math.hypot(
			(b.lon - a.lon) * 111.32 * Math.cos((a.lat * Math.PI) / 180),
			(b.lat - a.lat) * 110.57
		) * 1.4;
	return { s: Math.round((km / 35) * 3600), m: Math.round(km * 1000), estimated: true };
}
