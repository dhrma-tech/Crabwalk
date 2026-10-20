// Per-client rate limits for write endpoints (P10, closes the P4-3 deferral; BACKEND §14).
// Key = HMAC(salt, rule + client IP) so the DB never sees an IP. Fixed windows in public.rate_hits.
import type { RequestEvent } from '@sveltejs/kit';
import { RATE_LIMIT_SALT } from '$app/env/private';

export type Rule = {
	name: string;
	method: string;
	path: RegExp;
	/** Form actions: e.g. only `?/sendCode` on /login. */
	search?: RegExp;
	limit: number;
	windowS: number;
};

// Generous for people, tight for scripts. Reads are cached/CDN-friendly and not limited here.
export const RULES: Rule[] = [
	{
		name: 'login-code',
		method: 'POST',
		path: /^\/login$/,
		search: /^\?\/(sendCode|verifyCode)/,
		limit: 10,
		windowS: 600
	},
	{
		name: 'report',
		method: 'POST',
		path: /^\/api\/reports$|^\/q\/[^/]+\/report$/,
		limit: 10,
		windowS: 600
	},
	{ name: 'qr-scan', method: 'POST', path: /^\/q\/[^/]+\/scan$/, limit: 60, windowS: 600 },
	{ name: 'qr-visit', method: 'POST', path: /^\/q\/[^/]+\/visit$/, limit: 20, windowS: 600 },
	{
		name: 'vote',
		method: 'POST',
		path: /^\/api\/trips\/[^/]+\/vote$|^\/plan\/vote\/[^/]+$/,
		limit: 60,
		windowS: 600
	},
	{ name: 'plan', method: 'POST', path: /^\/api\/trips\/plan$/, limit: 20, windowS: 600 },
	{ name: 'trip-edit', method: 'PATCH', path: /^\/api\/trips\/[^/]+$/, limit: 120, windowS: 600 },
	{ name: 'ai', method: 'POST', path: /^\/api\/ai\//, limit: 40, windowS: 600 },
	{
		name: 'rating',
		method: 'POST',
		path: /^\/api\/(verdicts|subscores|reviews)$/,
		limit: 60,
		windowS: 600
	},
	{
		name: 'upload',
		method: 'POST',
		path: /^\/api\/(booking-proofs|admin\/photos)$/,
		limit: 30,
		windowS: 3600
	},
	{ name: 'claim', method: 'POST', path: /^\/api\/owner\/claim$/, limit: 5, windowS: 3600 },
	{
		name: 'consent',
		method: 'POST',
		path: /^\/api\/(dwell|push\/subscribe)$/,
		limit: 60,
		windowS: 3600
	}
];

export const ruleFor = (method: string, url: URL) =>
	RULES.find(
		(r) =>
			r.method === method && r.path.test(url.pathname) && (!r.search || r.search.test(url.search))
	);

async function hmac(text: string) {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(RATE_LIMIT_SALT || 'dev-only-salt'),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
	return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** True if allowed. Fails open (logs) if the counter is unreachable — never blocks people on our outage. */
export async function allowed(event: RequestEvent, rule: Rule) {
	const ip =
		event.request.headers.get('cf-connecting-ip') ??
		(() => {
			try {
				return event.getClientAddress();
			} catch {
				return 'unknown';
			}
		})();
	const { data, error } = await event.locals.supabase.rpc('rate_take', {
		_key: await hmac(`${rule.name}:${ip}`),
		// e2e builds sign in dozens of test users from one IP: same code path, 100× headroom.
		_limit: import.meta.env.MODE === 'e2e' ? rule.limit * 100 : rule.limit,
		_window_s: rule.windowS
	});
	if (error) {
		console.warn('rate limit unavailable', error.message);
		return true;
	}
	return data !== false;
}
