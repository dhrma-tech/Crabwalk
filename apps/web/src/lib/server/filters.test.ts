import { describe, expect, it } from 'vitest';
import { eateryFilter, placeFilter, readFilter, stayFilter } from './filters.ts';

const q = (s: string) => new URLSearchParams(s);

describe('readFilter', () => {
	it('parses valid filters and coerces the price', () => {
		expect(readFilter(stayFilter, q('vibe=beachfront&style=homely&max_price=2500'), true)).toEqual({
			vibe: 'beachfront',
			style: 'homely',
			max_price: 2500
		});
		expect(readFilter(placeFilter, q('category=fort&hidden_gem=1'), true)).toEqual({
			category: 'fort',
			hidden_gem: '1'
		});
	});

	it('strict (API): any bad value means the whole filter is rejected', () => {
		expect(readFilter(placeFilter, q('category=bogus'), true)).toBeNull();
		expect(readFilter(eateryFilter, q('diet=veg&authenticity=fancy'), true)).toBeNull();
	});

	it('lenient (pages): drops only the bad values', () => {
		expect(readFilter(eateryFilter, q('diet=veg&authenticity=fancy'))).toEqual({ diet: 'veg' });
		expect(readFilter(placeFilter, q('category=bogus'))).toEqual({});
	});

	it('ignores empty values (unset selects) and unknown keys', () => {
		expect(readFilter(stayFilter, q('vibe=&amenity=wifi&utm_source=x'), true)).toEqual({
			amenity: 'wifi'
		});
	});

	it('rejects prices that are not a sane positive integer', () => {
		for (const p of ['-5', 'abc', '0', '99999999999999999999', '12.5'])
			expect(readFilter(stayFilter, q(`max_price=${p}`), true), p).toBeNull();
	});
});
