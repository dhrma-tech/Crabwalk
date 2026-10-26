import { describe, expect, it } from 'vitest';
import { stripGeometry } from './strip.ts';

describe('route strip geometry', () => {
	const legs = [
		{
			from: { at: [73.3, 17.0] as [number, number] },
			to: { at: [73.4, 17.0] as [number, number], kind: 'place' },
			shape: null
		},
		{
			from: { at: [73.4, 17.0] as [number, number] },
			to: { at: [73.4, 17.05] as [number, number], kind: 'stay' },
			shape: null
		}
	];

	it('fits every stop inside the padded box', () => {
		const g = stripGeometry(legs, 320, 96, 12)!;
		const pts = g.stops.map((s) => s.at);
		for (const [x, y] of pts) {
			expect(x).toBeGreaterThanOrEqual(12);
			expect(x).toBeLessThanOrEqual(308);
			expect(y).toBeGreaterThanOrEqual(12);
			expect(y).toBeLessThanOrEqual(84);
		}
		expect(g.stops.map((s) => s.kind)).toEqual(['place', 'stay']);
	});

	it('marks legs without a stored shape as straight guides; north is up', () => {
		const g = stripGeometry(legs, 320, 96)!;
		expect(g.paths).toHaveLength(2);
		expect(g.paths.every((p) => p.guide)).toBe(true);
		// The stay is north of the place, so it sits higher (smaller y).
		expect(g.stops[1]!.at[1]).toBeLessThan(g.stops[0]!.at[1]);
	});

	it('lets a far start fall outside so the stops stay readable', () => {
		const far = [{ ...legs[0]!, from: { at: [72.0, 18.5] as [number, number] } }, legs[1]!];
		const g = stripGeometry(far, 320, 96, 12)!;
		const [x, y] = g.start!;
		expect(x < 0 || y < 0 || x > 320 || y > 96).toBe(true);
		expect(g.stops[0]!.at[0]).toBeGreaterThanOrEqual(12);
	});

	it('decodes a stored polyline and returns null with no points', () => {
		const g = stripGeometry(
			[
				{
					from: { at: null },
					to: { at: [-120.2, 38.5], kind: 'place' },
					shape: '_p~iF~ps|U_ulLnnqC'
				}
			],
			320,
			96
		)!;
		expect(g.paths[0]).toMatchObject({ guide: false });
		expect(g.start).toBeNull();
		expect(stripGeometry([], 320, 96)).toBeNull();
	});
});
