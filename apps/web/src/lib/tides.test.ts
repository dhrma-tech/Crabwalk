import { expect, it } from 'vitest';
import { heightAt, tideState } from './tides.ts';

const date = '2026-10-20';
const ex = [
	{ time: '2026-10-20T00:30:00Z', height_m: 0.4 }, // 06:00 IST low
	{ time: '2026-10-20T06:45:00Z', height_m: 1.8 } //  12:15 IST high
];
it('interpolates between extremes and is unknown outside them', () => {
	expect(heightAt(ex, date, 6 * 60)).toBeCloseTo(0.4);
	expect(heightAt(ex, date, 12 * 60 + 15)).toBeCloseTo(1.8);
	expect(heightAt(ex, date, 9 * 60 + 7)).toBeCloseTo(1.1, 1); // midpoint
	expect(heightAt(ex, date, 5 * 60)).toBeNull();
});
it('state: ok below the rule, cut above, unknown without rule/data', () => {
	expect(tideState(ex, 1.0, date, 6 * 60 + 30)).toBe('ok');
	expect(tideState(ex, 1.0, date, 12 * 60)).toBe('cut');
	expect(tideState(ex, null, date, 7 * 60)).toBe('unknown');
	expect(tideState(null, 1, date, 7 * 60)).toBe('unknown');
	expect(tideState(ex, 1, date, 20 * 60)).toBe('unknown');
});
