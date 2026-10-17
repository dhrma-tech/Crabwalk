import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from 'jose';
import { handle, type Env } from './handler.ts';

const SUPA = 'https://example.supabase.co';
let jwks: JWTVerifyGetKey;
let token: string;

beforeAll(async () => {
	const { publicKey, privateKey } = await generateKeyPair('ES256');
	jwks = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), alg: 'ES256', kid: 'k' }] });
	token = await new SignJWT({ role: 'authenticated' })
		.setProtectedHeader({ alg: 'ES256', kid: 'k' })
		.setSubject('user-1')
		.setIssuer(`${SUPA}/auth/v1`)
		.setAudience('authenticated')
		.setExpirationTime('5m')
		.sign(privateKey);
});

const env = (over: Partial<Env> = {}): Env => ({ OLA_API_KEY: 'secret-key', SUPABASE_URL: SUPA, ...over });
const req = (path: string, auth = true) =>
	new Request(`https://proxy.test${path}`, { headers: auth ? { Authorization: `Bearer ${token}` } : {} });

describe('ola-proxy', () => {
	it('rejects anonymous requests (login-only)', async () => {
		const res = await handle(req('/ola/autocomplete?q=ganpati', false), env(), { jwks });
		expect(res.status).toBe(401);
	});

	it('rejects a forged token', async () => {
		const bad = new Request('https://proxy.test/ola/autocomplete?q=ganpati', { headers: { Authorization: 'Bearer x.y.z' } });
		expect((await handle(bad, env(), { jwks })).status).toBe(401);
	});

	it('proxies autocomplete with no-store and an attribution flag', async () => {
		const fetch = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
			Response.json({ predictions: [{ description: 'Ganpatipule', place_id: 'p1', geometry: { location: { lat: 17.1, lng: 73.2 } } }] })
		);
		const res = await handle(req('/ola/autocomplete?q=ganpati'), env(), { jwks, fetch });
		expect(res.status).toBe(200);
		expect(res.headers.get('Cache-Control')).toBe('private, no-store');
		expect(await res.json()).toEqual({
			attribution: 'ola',
			results: [{ description: 'Ganpatipule', place_id: 'p1', lat: 17.1, lng: 73.2 }]
		});
		expect(String(fetch.mock.calls[0][0])).toContain('/places/v1/autocomplete?input=ganpati');
	});

	it('normalises directions and validates coordinates', async () => {
		const fetch = vi.fn(async () =>
			Response.json({ routes: [{ overview_polyline: 'abc', legs: [{ distance: 1000, duration: 120 }, { distance: 500, duration: 60 }] }] })
		);
		const ok = await handle(req('/ola/directions?from=17.1,73.2&to=16.99,73.3'), env(), { jwks, fetch });
		expect(await ok.json()).toEqual({ attribution: 'ola', route: { polyline: 'abc', distance_m: 1500, duration_s: 180 } });
		const bad = await handle(req('/ola/directions?from=x&to=16.99,73.3'), env(), { jwks, fetch });
		expect(bad.status).toBe(400);
	});

	it('enforces the per-user rate limit', async () => {
		const USER_LIMIT = { limit: vi.fn(async () => ({ success: false })) };
		const res = await handle(req('/ola/autocomplete?q=ganpati'), env({ USER_LIMIT }), { jwks });
		expect(res.status).toBe(429);
		expect(USER_LIMIT.limit).toHaveBeenCalledWith({ key: 'user-1' });
	});

	it('never leaks the API key in responses', async () => {
		const fetch = vi.fn(async () => new Response('boom', { status: 500 }));
		const res = await handle(req('/ola/autocomplete?q=ganpati'), env(), { jwks, fetch });
		expect(await res.text()).not.toContain('secret-key');
	});
});
