import { describe, expect, it } from 'vitest';
import { correctedDuration, expectedPairs, segKey, type Flag } from './correct.ts';

const f = { ghat: 1.4, coastal: 1.2, monsoon: 1.25, monsoonMonths: [6, 7, 8, 9] };
const set = (...x: Flag[]) => new Set(x);

describe('correctedDuration', () => {
	it('equals raw when nothing is flagged outside monsoon', () => {
		expect(correctedDuration([60, 40], [undefined, undefined], f, 10)).toBe(100);
	});
	it('is ≥ raw and scales only flagged segments', () => {
		const c = correctedDuration([60, 40], [set('ghat'), undefined], f, 10);
		expect(c).toBe(124); // 60×1.4 + 40
		expect(c).toBeGreaterThanOrEqual(100);
	});
	it('uses the larger factor when a segment is ghat and coastal', () => {
		expect(correctedDuration([100], [set('ghat', 'coastal')], f, 1)).toBe(140);
	});
	it('applies monsoon to the whole trip only in active months', () => {
		expect(correctedDuration([100], [set('coastal')], f, 7)).toBe(150); // 100×1.2×1.25
		expect(correctedDuration([100], [set('coastal')], f, 10)).toBe(120);
	});
	it('never drops below raw even with factor 1', () => {
		const one = { ghat: 1, coastal: 1, monsoon: 1, monsoonMonths: [] };
		expect(correctedDuration([33.3, 33.3], [set('ghat'), undefined], one, 1)).toBe(67);
	});
});

describe('pairs', () => {
	it('N×(N−1) ordered pairs', () => {
		expect(expectedPairs(11)).toBe(110);
		expect(expectedPairs(1)).toBe(0);
	});
	it('segment key is direction-free', () => {
		expect(segKey(5, 2)).toBe(segKey(2, 5));
	});
});
