import { describe, expect, it } from 'vitest';
import { readSort, sortListings } from './sort.ts';

const agg = (counts: number[], isNew = false) => ({
	counts,
	total: counts.reduce((a, b) => a + b, 0),
	is_new: isNew
});
const items = [
	{ name: 'Unrated', agg: null, low: null, high: null },
	{ name: 'New', agg: agg([0, 0, 2, 1], true), low: 900, high: 1200 },
	{ name: 'Mixed', agg: agg([5, 5, 5, 5]), low: 1500, high: 3000 },
	{ name: 'Loved', agg: agg([0, 1, 4, 10]), low: 2500, high: null },
	{ name: 'Loved less', agg: agg([0, 1, 2, 5]), low: 700, high: 1000 }
];
const run = (sort: 'best' | 'price_asc' | 'price_desc') =>
	sortListings(items, sort, (t) => ({ low: t.low, high: t.high })).map((t) => t.name);

describe('list sort', () => {
	it('best: rated by top-two share, then votes; new; unrated', () => {
		// Loved: 14 of 15 votes in the top two (0.93) beats Loved less: 7 of 8 (0.875).
		expect(run('best')).toEqual(['Loved', 'Loved less', 'Mixed', 'New', 'Unrated']);
	});
	it('price low → high, no price last', () => {
		expect(run('price_asc')).toEqual(['Loved less', 'New', 'Mixed', 'Loved', 'Unrated']);
	});
	it('price high → low uses the top of the range, no price last', () => {
		expect(run('price_desc')).toEqual(['Mixed', 'Loved', 'New', 'Loved less', 'Unrated']);
	});
	it('readSort falls back to best', () => {
		expect(readSort('price_asc')).toBe('price_asc');
		expect(readSort('nearest')).toBe('best');
		expect(readSort(null)).toBe('best');
	});
});
