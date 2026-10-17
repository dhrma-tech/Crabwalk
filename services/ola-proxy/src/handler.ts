// Ola Maps proxy (BACKEND §6.1). Login-only (B11), per-user rate limit, never cached server-side,
// never written to any DB. Responses carry an attribution flag so the UI shows "Ola Maps".
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export type Env = {
	OLA_API_KEY: string;
	SUPABASE_URL: string;
	USER_LIMIT?: { limit(o: { key: string }): Promise<{ success: boolean }> };
};

// Endpoints per community clients; VERIFY against the official API reference once a key exists (DECISIONS P3-6).
const OLA = 'https://api.olamaps.io';
const NO_STORE = { 'Cache-Control': 'private, no-store', 'Content-Type': 'application/json' };
const LATLNG = /^-?\d{1,2}(\.\d+)?,-?\d{1,3}(\.\d+)?$/;

const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: NO_STORE });

let jwks: JWTVerifyGetKey | undefined;

export async function handle(req: Request, env: Env, deps: { fetch?: typeof fetch; jwks?: JWTVerifyGetKey } = {}) {
	const f = deps.fetch ?? fetch;
	const url = new URL(req.url);
	if (req.method !== 'GET') return out({ error: 'method' }, 405);

	// Supabase access token (ES256, JWKS) — signed-in users only.
	const token = req.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
	if (!token) return out({ error: 'auth' }, 401);
	let userId: string;
	try {
		const keys = deps.jwks ?? (jwks ??= createRemoteJWKSet(new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)));
		const { payload } = await jwtVerify(token, keys, { issuer: `${env.SUPABASE_URL}/auth/v1`, audience: 'authenticated' });
		userId = String(payload.sub);
	} catch {
		return out({ error: 'auth' }, 401);
	}
	if (env.USER_LIMIT && !(await env.USER_LIMIT.limit({ key: userId })).success) return out({ error: 'rate' }, 429);

	if (url.pathname === '/ola/autocomplete') {
		const q = url.searchParams.get('q')?.trim() ?? '';
		if (q.length < 3 || q.length > 100) return out({ error: 'q' }, 400);
		const res = await f(`${OLA}/places/v1/autocomplete?input=${encodeURIComponent(q)}&api_key=${env.OLA_API_KEY}`);
		if (!res.ok) return out({ error: 'upstream', status: res.status }, res.status === 429 ? 429 : 502);
		const body = (await res.json()) as {
			predictions?: { description: string; place_id: string; geometry?: { location?: { lat: number; lng: number } } }[];
		};
		return out({
			attribution: 'ola',
			results: (body.predictions ?? []).map((p) => ({
				description: p.description,
				place_id: p.place_id,
				lat: p.geometry?.location?.lat ?? null,
				lng: p.geometry?.location?.lng ?? null
			}))
		});
	}

	if (url.pathname === '/ola/directions') {
		const from = url.searchParams.get('from') ?? '', to = url.searchParams.get('to') ?? '';
		if (!LATLNG.test(from) || !LATLNG.test(to)) return out({ error: 'from/to' }, 400);
		const res = await f(`${OLA}/routing/v1/directions?origin=${from}&destination=${to}&api_key=${env.OLA_API_KEY}`, {
			method: 'POST'
		});
		if (!res.ok) return out({ error: 'upstream', status: res.status }, res.status === 429 ? 429 : 502);
		const body = (await res.json()) as {
			routes?: { overview_polyline: string; legs: { distance: number; duration: number }[] }[];
		};
		const r = body.routes?.[0];
		if (!r) return out({ attribution: 'ola', route: null });
		return out({
			attribution: 'ola',
			route: {
				polyline: r.overview_polyline,
				distance_m: r.legs.reduce((s, l) => s + l.distance, 0),
				duration_s: r.legs.reduce((s, l) => s + l.duration, 0)
			}
		});
	}

	return out({ error: 'not found' }, 404);
}
