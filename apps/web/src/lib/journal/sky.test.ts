import { describe, expect, it } from 'vitest';
import { istHours, phaseAt, skyAt, GOLDEN } from './sky.ts';

describe('journal sky', () => {
	it('reads Ratnagiri time (UTC+5:30)', () => {
		expect(istHours(Date.UTC(2026, 0, 1, 0, 30))).toBeCloseTo(6);
		expect(istHours(Date.UTC(2026, 0, 1, 18, 30))).toBeCloseTo(0);
	});
	it('maps hours to phases', () => {
		expect(phaseAt(6.2)).toBe('dawn');
		expect(phaseAt(12)).toBe('day');
		expect(phaseAt(18)).toBe('golden');
		expect(phaseAt(22)).toBe('night');
		expect(phaseAt(3)).toBe('night');
	});
	it('keeps the sun inside the sky and highest at midday', () => {
		const noon = skyAt(12.5);
		expect(noon.y).toBeLessThan(skyAt(7).y);
		for (let h = 0; h < 24; h += 0.5) {
			const s = skyAt(h);
			expect(s.x).toBeGreaterThanOrEqual(0);
			expect(s.x).toBeLessThanOrEqual(1);
			expect(s.y).toBeGreaterThan(0);
		}
	});
	it('shows stars only at night and falls back to golden hour', () => {
		expect(skyAt(23).stars).toBe(1);
		expect(skyAt(12).stars).toBe(0);
		expect(GOLDEN.phase).toBe('golden');
	});
});
