import { describe, expect, it } from 'vitest';
import {
	estimate,
	estimatedLeg,
	gmapsLinks,
	LUNCH,
	plan,
	retime,
	type DayOpen,
	type EateryCand,
	type PlaceCand,
	type PlanInput
} from './engine.ts';

const H = (h: number, m = 0) => h * 60 + m;
const allDay: DayOpen = { wins: [[H(7), H(18, 30)]], confirmed: false };

function place(
	id: string,
	lon: number,
	lat: number,
	o: Partial<PlaceCand> = {},
	days = 2
): PlaceCand {
	return {
		id,
		lon,
		lat,
		category: 'fort',
		visitMin: 60,
		fee: null,
		tideDependent: false,
		days: Array.from({ length: days }, () => ({
			open: { wins: [[H(9), H(17)]], confirmed: true },
			score: 2,
			reasons: []
		})),
		...o
	};
}
const eatery = (id: string, lon: number, lat: number, days = 2): EateryCand => ({
	id,
	lon,
	lat,
	costPerPerson: 200,
	days: Array.from({ length: days }, () => ({ wins: [[H(11), H(22)]], confirmed: true }))
});

// A ~10 km × 10 km cluster around (73.3, 17.0); travel = straight-line estimate.
const grid = Array.from({ length: 16 }, (_, i) =>
	place(`p${String(i).padStart(2, '0')}`, 73.3 + (i % 4) * 0.02, 17 + Math.floor(i / 4) * 0.02)
);
const base = (o: Partial<PlanInput> = {}): PlanInput => ({
	days: 2,
	start: { lon: 73.28, lat: 16.98 },
	dayStart: H(9),
	pace: 'balanced',
	budget: 20000,
	places: grid,
	eateries: [eatery('e1', 73.32, 17.02), eatery('e2', 73.34, 17.05)],
	stays: [
		{ id: 's-cheap', lon: 73.31, lat: 17.01, price: 1500 },
		{ id: 's-dear', lon: 73.3, lat: 17.0, price: 9000 }
	],
	travel: estimatedLeg,
	...o
});

describe('planner engine', () => {
	it('never schedules a place outside its open windows (incl. tide windows)', () => {
		const odd = [
			place('narrow', 73.3, 17, {
				days: [0, 1].map(() => ({
					open: { wins: [[H(15), H(16, 30)]], confirmed: true },
					score: 5,
					reasons: []
				}))
			}),
			place('tide', 73.31, 17, {
				tideDependent: true,
				days: [0, 1].map(() => ({
					open: {
						wins: [
							[H(9), H(10)],
							[H(14), H(15, 15)]
						],
						confirmed: true
					},
					score: 5,
					reasons: []
				}))
			}),
			place('closed-day1', 73.32, 17, {
				days: [
					{ open: null, score: 9, reasons: [] },
					{ open: { wins: [[H(9), H(17)]], confirmed: true }, score: 2, reasons: [] }
				]
			}),
			...grid
		];
		const inp = base({ places: odd });
		const days = plan(inp);
		for (const [d, day] of days.entries())
			for (const s of day.stops.filter((x) => x.kind === 'place')) {
				const open = inp.places.find((p) => p.id === s.id)!.days[d]!.open!;
				expect(open, `${s.id} planned on a closed day ${d}`).not.toBeNull();
				expect(
					open.wins.some(([a, b]) => s.arrive >= a && s.depart <= b),
					`${s.id} ${s.arrive}-${s.depart} outside ${JSON.stringify(open.wins)}`
				).toBe(true);
			}
		expect(days[0]!.stops.some((s) => s.id === 'closed-day1')).toBe(false);
		const tide = days.flatMap((d) => d.stops).find((s) => s.id === 'tide');
		if (tide) expect(tide.reasons).toContain('tide_safe');
	});

	it('respects pace hours and never repeats a place', () => {
		for (const pace of ['relaxed', 'balanced', 'packed'] as const) {
			const days = plan(base({ pace }));
			const ids = days.flatMap((d) => d.stops.filter((s) => s.kind === 'place').map((s) => s.id));
			expect(new Set(ids).size).toBe(ids.length);
			for (const d of days) {
				const places = d.stops.filter((s) => s.kind === 'place');
				const lunch = d.stops.some((s) => s.kind === 'meal' && s.arrive < H(16))
					? LUNCH.minutes
					: 0;
				if (places.length)
					expect(places.at(-1)!.depart).toBeLessThanOrEqual(
						H(9) + { relaxed: 6, balanced: 8, packed: 10 }[pace] * 60 + lunch
					);
			}
		}
	});

	it('adds lunch in its window, dinner, and a stay on every night but the last', () => {
		const days = plan(base());
		const lunch = days[0]!.stops.find((s) => s.kind === 'meal' && s.arrive < H(16));
		expect(lunch).toBeDefined();
		expect(lunch!.arrive).toBeGreaterThanOrEqual(LUNCH.from);
		expect(lunch!.arrive).toBeLessThanOrEqual(LUNCH.to - LUNCH.minutes);
		expect(days[0]!.stops.at(-1)!.kind).toBe('stay');
		expect(days[1]!.stops.some((s) => s.kind === 'stay')).toBe(false);
		expect(days[0]!.stops.find((s) => s.kind === 'stay')!.id).toBe('s-cheap'); // fits nightly cap
	});

	it('is deterministic', () => {
		expect(plan(base())).toEqual(plan(base()));
	});

	it('flags hours-unconfirmed and sunset reasons', () => {
		const beach = place('beach', 73.3, 17, {
			category: 'beach',
			days: [0, 1].map(() => ({
				open: { wins: [[H(17), H(18, 30)]], confirmed: false },
				score: 9,
				reasons: ['low_crowd']
			}))
		});
		const s = plan(base({ places: [beach, ...grid], days: 1 }))[0]!.stops.find(
			(x) => x.id === 'beach'
		)!;
		expect(s.reasons).toEqual(expect.arrayContaining(['low_crowd', 'sunset', 'hours_unconfirmed']));
		void allDay;
	});

	it('retime flags a stop moved outside its hours', () => {
		const r = retime(
			[
				{
					kind: 'place',
					id: 'a',
					pt: { lon: 73.3, lat: 17 },
					minutes: 60,
					open: { wins: [[H(9), H(10)]], confirmed: true }
				},
				{
					kind: 'place',
					id: 'b',
					pt: { lon: 73.3, lat: 17 },
					minutes: 60,
					open: { wins: [[H(9), H(10)]], confirmed: true }
				}
			],
			{ lon: 73.3, lat: 17 },
			H(9),
			estimatedLeg
		);
		expect(r[0]!.conflict).toBe(false);
		expect(r[1]!.conflict).toBe(true);
	});
});

describe('Google Maps export', () => {
	it('≤ 10 points per link; links chain', () => {
		for (const n of [2, 10, 11, 19, 25]) {
			const pts = Array.from({ length: n }, (_, i) => ({ lon: 73 + i / 100, lat: 17 }));
			const links = gmapsLinks(pts);
			for (const l of links) {
				const q = new URL(l).searchParams;
				const wp = q.get('waypoints')?.split('|').length ?? 0;
				expect(wp + 2).toBeLessThanOrEqual(10);
			}
			expect(links.length).toBe(Math.ceil((n - 1) / 9));
			expect(new URL(links.at(-1)!).searchParams.get('destination')).toBe(
				`17.00000,${(73 + (n - 1) / 100).toFixed(5)}`
			);
		}
	});
});

describe('budget estimator', () => {
	it('sums lines, splits per person, never invents fuel', () => {
		const b = estimate({
			people: 4,
			stayPrices: [2000, null],
			mealCosts: [200, 300],
			fees: [25, null],
			km: 150,
			fuelPrice: null,
			mileage: 15,
			activities: 500
		});
		expect(b).toMatchObject({
			stay: 2000,
			food: 2000,
			fuel: null,
			entry: 100,
			entryUnknown: 1,
			total: 4600,
			perPerson: 1150
		});
		expect(
			estimate({
				people: 1,
				stayPrices: [],
				mealCosts: [],
				fees: [],
				km: 150,
				fuelPrice: 105,
				mileage: 15,
				activities: 0
			}).fuel
		).toBe(1050);
	});
});
