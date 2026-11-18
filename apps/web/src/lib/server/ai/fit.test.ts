import { describe, expect, it } from 'vitest';
import { fit } from './fit.ts';

const place = (i: number) => ({ slug: `place-${i}`, name: `Place ${i}`, km: i * 1.5 });

describe('fit (T2-01)', () => {
	it('returns the JSON unchanged when it fits', () => {
		expect(fit({ a: 1 }, 100)).toBe('{"a":1}');
		expect(fit(undefined, 10)).toBe('null');
	});

	it('shortens story/history/description/transcript before anything else', () => {
		const v = { slug: 'fort', name: 'Fort', story: 'x'.repeat(5000), places: [place(1), place(2)] };
		const out = fit(v, 400);
		expect(out.length).toBeLessThanOrEqual(400);
		const r = JSON.parse(out);
		expect(r.places).toEqual([place(1), place(2)]);
		expect(r.name).toBe('Fort');
		expect(r.story.endsWith('…')).toBe(true);
		expect(r.story.length).toBeGreaterThan(100);
	});

	it('cuts an array to the longest prefix that fits, with a truncated count', () => {
		const out = fit(
			Array.from({ length: 50 }, (_, i) => place(i)),
			500
		);
		expect(out.length).toBeLessThanOrEqual(500);
		const r = JSON.parse(out);
		const last = r.at(-1);
		expect(last).toEqual({ truncated: 50 - (r.length - 1) });
		expect(r.slice(0, -1)).toEqual(Array.from({ length: r.length - 1 }, (_, i) => place(i)));
		// one more item would not have fitted
		expect(
			JSON.stringify([...r.slice(0, -1), place(r.length - 1), { truncated: last.truncated - 1 }])
				.length
		).toBeGreaterThan(500);
	});

	it('cuts the big array inside a single tool result, not the result itself', () => {
		const v = [
			{ tool: 'nearby', result: { places: Array.from({ length: 80 }, (_, i) => place(i)) } }
		];
		const r = JSON.parse(fit(v, 1000));
		expect(r).toHaveLength(1);
		expect(r[0].tool).toBe('nearby');
		expect(r[0].result.places.at(-1)).toHaveProperty('truncated');
		expect(r[0].result.places[0]).toEqual(place(0));
	});

	it('is always valid JSON within the limit', () => {
		const v = {
			name: 'y'.repeat(3000),
			tags: Array.from({ length: 30 }, () => 'z'.repeat(200)),
			nested: [[{ description: 'd'.repeat(900) }]]
		};
		for (const max of [20, 60, 200, 1000, 4000]) {
			const out = fit(v, max);
			expect(out.length).toBeLessThanOrEqual(max);
			expect(() => JSON.parse(out)).not.toThrow();
		}
		expect(fit(v, 5)).toBe('null');
	});
});
