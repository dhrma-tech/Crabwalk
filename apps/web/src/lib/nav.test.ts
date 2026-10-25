import { describe, expect, it } from 'vitest';
import { isActive } from './nav.ts';

describe('isActive', () => {
	it('Discover only on the home page', () => {
		expect(isActive('/', '/')).toBe(true);
		expect(isActive('/map', '/')).toBe(false);
	});
	it('an item covers its first path segment', () => {
		expect(isActive('/plan/abc', '/plan/new')).toBe(true);
		expect(isActive('/plan/vote/t1', '/plan/new')).toBe(true);
		expect(isActive('/me', '/me')).toBe(true);
	});
	it('needs a segment boundary', () => {
		expect(isActive('/mapping', '/map')).toBe(false);
		expect(isActive('/itineraries', '/itin')).toBe(false);
	});
});
