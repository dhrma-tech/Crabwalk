import { describe, expect, it } from 'vitest';
import { loginHref, nextPath } from './login.ts';

describe('nextPath (post-sign-in return path)', () => {
	it('keeps same-origin paths with their query', () => {
		expect(nextPath('/plan/new')).toBe('/plan/new');
		expect(nextPath('/stays?vibe=beachfront')).toBe('/stays?vibe=beachfront');
	});

	it('refuses anything that could leave the site or loop', () => {
		for (const v of [
			'//evil.example',
			'/\\evil.example',
			'https://evil.example',
			'evil',
			'',
			'/login'
		])
			expect(nextPath(v), v).toBeNull();
		expect(nextPath(null)).toBeNull();
		expect(nextPath(42)).toBeNull();
	});
});

describe('loginHref', () => {
	it('encodes the current path and query as next', () => {
		expect(loginHref({ pathname: '/stays', search: '?vibe=family&max_price=2000' })).toBe(
			'/login?next=%2Fstays%3Fvibe%3Dfamily%26max_price%3D2000'
		);
	});
});
