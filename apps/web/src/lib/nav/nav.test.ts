import { describe, expect, it } from 'vitest';
import { cumulative, decodePolyline, decodeTurns, navState, type LL } from './nav.ts';

describe('navigation maths', () => {
	it('decodes polyline5 (Google example)', () => {
		expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
			[-120.2, 38.5],
			[-120.95, 40.7],
			[-126.453, 43.252]
		]);
	});
	it('decodes compact turns', () => {
		expect(decodeTurns('14L,52SR,80O2')).toEqual([
			{ at: 14, code: 'L' },
			{ at: 52, code: 'SR' },
			{ at: 80, code: 'O2' }
		]);
		expect(decodeTurns(null)).toEqual([]);
	});
	// East 1 km, then north 1 km; a left turn at the corner.
	const line: LL[] = [
		[73, 17],
		[73.0094, 17],
		[73.0094, 17.009]
	];
	const cum = cumulative(line);
	it('next turn, distance left, ETA, on/off route', () => {
		const s = navState(line, cum, [{ at: 1, code: 'L' }], [73.0047, 17.0001], 240);
		expect(s.offRoute).toBe(false);
		expect(s.next?.code).toBe('L');
		expect(s.next!.in).toBeGreaterThan(450);
		expect(s.next!.in).toBeLessThan(550);
		expect(s.left).toBeGreaterThan(1400);
		expect(s.etaMin).toBe(3);
		const after = navState(line, cum, [{ at: 1, code: 'L' }], [73.0094, 17.004], 240);
		expect(after.next).toBeNull();
		expect(navState(line, cum, [], [73.005, 17.002], 240).offRoute).toBe(true);
	});
});
