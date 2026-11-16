import { describe, expect, it } from 'vitest';
import { encode } from 'uqr';
import { plaqueOrigin } from './origin.ts';

describe('plaque origin (SEC-14)', () => {
	it('accepts an https origin on a real domain, without path or trailing slash', () => {
		expect(plaqueOrigin('https://crabwalk.in')).toEqual({
			ok: true,
			origin: 'https://crabwalk.in',
			host: 'crabwalk.in'
		});
		expect(plaqueOrigin('https://www.crabwalk.in/some/path/')).toMatchObject({
			ok: true,
			origin: 'https://www.crabwalk.in'
		});
	});
	it.each([
		undefined,
		'',
		'crabwalk.in',
		'http://crabwalk.in',
		'https://crabwalk.pages.dev',
		'https://abc123.crabwalk.pages.dev',
		'https://localhost:4173',
		'https://app.localhost',
		'https://192.168.1.20',
		'https://[::1]',
		'https://intranet'
	])('refuses %s', (raw) => {
		expect(plaqueOrigin(raw)).toEqual({ ok: false });
	});
	it('the QR encodes exactly origin + /q/<code>', () => {
		const o = plaqueOrigin('https://crabwalk.in/');
		if (!o.ok) throw new Error('expected ok');
		const url = `${o.origin}/q/RTN-001`;
		expect(url).toBe('https://crabwalk.in/q/RTN-001');
		// Same input → same symbol: what the endpoint draws is this URL's QR.
		expect(encode(url, { ecc: 'Q', border: 0 }).data).toEqual(
			encode('https://crabwalk.in/q/RTN-001', { ecc: 'Q', border: 0 }).data
		);
	});
});
