import { describe, expect, it } from 'vitest';
import { addDays, hoursOpen, tideSafeWindows } from './data.ts';

const H = (h: number, m = 0) => h * 60 + m;
const daylight: [number, number] = [H(7), H(18, 30)];

describe('hoursOpen (DECISIONS P7-3)', () => {
	const rows = [
		{ weekday: 1, opens: '09:00:00', closes: '17:30:00', hours_unknown: false },
		{ weekday: 2, opens: null, closes: null, hours_unknown: false },
		{ weekday: 3, opens: null, closes: null, hours_unknown: true }
	];
	it('real hours are strict and confirmed', () => {
		expect(hoursOpen(rows, 1, daylight)).toEqual({ wins: [[H(9), H(17, 30)]], confirmed: true });
	});
	it('empty times = closed that day', () => {
		expect(hoursOpen(rows, 2, daylight)).toBeNull();
	});
	it('unknown or missing day = daylight only, unconfirmed', () => {
		expect(hoursOpen(rows, 3, daylight)).toEqual({ wins: [daylight], confirmed: false });
		expect(hoursOpen(rows, 0, daylight)).toEqual({ wins: [daylight], confirmed: false });
		expect(hoursOpen([], 5, daylight)).toEqual({ wins: [daylight], confirmed: false });
	});
});

describe('tideSafeWindows (DECISIONS P7-4)', () => {
	// 2026-10-20 IST: low 0.4 m at 06:00, high 1.8 m at 12:15, low 0.5 m at 18:30.
	const date = '2026-10-20';
	const ex = [
		{ time: '2026-10-20T00:30:00Z', height_m: 0.4 },
		{ time: '2026-10-20T06:45:00Z', height_m: 1.8 },
		{ time: '2026-10-20T13:00:00Z', height_m: 0.5 }
	];
	it('only times at or below the safe height, and only between known extremes', () => {
		const w = tideSafeWindows(ex, date, 1.0);
		expect(w.length).toBe(2);
		const [morning, evening] = w as [[number, number], [number, number]];
		expect(morning[0]).toBe(H(6)); // first extreme, not before (unknown = unsafe)
		expect(morning[1]).toBeGreaterThan(H(8));
		expect(morning[1]).toBeLessThan(H(9, 30));
		expect(evening[0]).toBeGreaterThan(H(15));
		expect(evening[1]).toBe(H(18, 30));
		// Mid-tide sanity: at the high it must be unsafe.
		expect(w.some(([a, b]) => a <= H(12, 15) && b >= H(12, 15))).toBe(false);
	});
	it('never safe when the rule is below the lowest tide', () => {
		expect(tideSafeWindows(ex, date, 0.2)).toEqual([]);
	});
});

describe('addDays', () => {
	it('crosses months and gives the IST weekday', () => {
		expect(addDays('2026-10-31', 1)).toEqual({ date: '2026-11-01', weekday: 0 });
	});
});
