// Per-client rate limits for write endpoints (P10, closes the P4-3 deferral; BACKEND §14).
// Key = HMAC(salt, rule + client IP) so the DB never sees an IP. Fixed windows in public.rate_hits.
// Hardening 2026-11 (SEC-06): the counter RPC is service-role only, the IP comes only from the platform
// (never from a request header), and production refuses to run without RATE_LIMIT_SALT.
import type { RequestEvent } from '@sveltejs/kit';
import { RATE_LIMIT_SALT } from '$app/env/private';
import { serviceClient } from './service.ts';
import { securityEvent } from './log.ts';

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
	// TODO(before-deploy): restore full auth — temp admin email gate (lib/server/gate.ts): no allowlist guessing.
	{ name: 'admin-gate', method: 'POST', path: /^\/auth\/admin$/, limit: 10, windowS: 600 },
	// Guest sessions handed over by the browser (SEC-02); Supabase Auth limits the sign-ups themselves.
	{ name: 'guest', method: 'POST', path: /^\/auth\/guest$/, limit: 20, windowS: 600 },
	{
		name: 'report',
		method: 'POST',
		path: /^\/api\/reports$|^\/q\/[^/]+\/report$/,
		limit: 10,
		windowS: 600
	},
	// Browsers send one report per violation; a broken deploy must not flood the logs.
	{ name: 'csp-report', method: 'POST', path: /^\/api\/csp-report$/, limit: 60, windowS: 600 },
	{ name: 'qr-scan', method: 'POST', path: /^\/q\/[^/]+\/scan$/, limit: 60, windowS: 600 },
	{ name: 'qr-visit', method: 'POST', path: /^\/q\/[^/]+\/visit$/, limit: 20, windowS: 600 },
	// Trip group chat (P12): messages, poll votes, applying Crabby's cards. The no-login vote link is retired.
	{
		name: 'chat',
		method: 'POST',
		path: /^\/api\/trips\/[^/]+\/chat(\/[^/]+\/(vote|apply))?$/,
		limit: 60,
		windowS: 600
	},
	{
		name: 'plan',
		method: 'POST',
		path: /^\/api\/trips\/(plan|[^/]+\/generate)$/,
		limit: 20,
		windowS: 600
	},
	// Availability requests to owners (P12): the DB also caps 10 a day per traveller.
	{ name: 'stay-request', method: 'POST', path: /^\/api\/requests$/, limit: 20, windowS: 3600 },
	{ name: 'trip-edit', method: 'PATCH', path: /^\/api\/trips\/[^/]+$/, limit: 120, windowS: 600 },
	{ name: 'ai', method: 'POST', path: /^\/api\/ai\/(?!feedback$)/, limit: 40, windowS: 600 },
	// SEC-11: the 10-minute rule alone allows 5,760 AI requests a day from one network.
	{ name: 'ai-day', method: 'POST', path: /^\/api\/ai\/(?!feedback$)/, limit: 150, windowS: 86400 },
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
	// Outbound booking clicks (T1-10, UX-11): `/out/<offer>` redirects to the stored link.
	{ name: 'out', method: 'GET', path: /^\/out\/[^/]+$/, limit: 60, windowS: 600 },
	// Crabby thumbs and "send to our team" (T2-05): not model calls, so outside the two AI rules above.
	{ name: 'ai-feedback', method: 'POST', path: /^\/api\/ai\/feedback$/, limit: 30, windowS: 600 },
	// First-party analytics (T1-11).
	{ name: 'events', method: 'POST', path: /^\/api\/e$/, limit: 240, windowS: 600 },
	// Account export and deletion (SEC-15).
	{ name: 'me-export', method: 'GET', path: /^\/api\/me\/export$/, limit: 10, windowS: 3600 },
	{ name: 'me-delete', method: 'POST', path: /^\/api\/me\/delete$/, limit: 5, windowS: 3600 },
	{ name: 'claim', method: 'POST', path: /^\/api\/owner\/claim$/, limit: 5, windowS: 3600 },
	{
		name: 'consent',
		method: 'POST',
		path: /^\/api\/(dwell|push\/subscribe)$/,
		limit: 60,
		windowS: 3600
	}
];

/** Every rule that covers the request (an endpoint can have a short and a daily window). */
export const rulesFor = (method: string, url: URL) =>
	RULES.filter(
		(r) =>
			r.method === method && r.path.test(url.pathname) && (!r.search || r.search.test(url.search))
	);

// Checked on first use, not at import: the build prerenders through the hooks with no secrets bound.
function salt() {
	if (RATE_LIMIT_SALT) return RATE_LIMIT_SALT;
	if (import.meta.env.PROD) throw new Error('RATE_LIMIT_SALT not set');
	return 'dev-only-salt';
}

/** Hex HMAC-SHA256 keyed with RATE_LIMIT_SALT. Also signs the QR scan token and derives dwell ids. */
export async function hmac(text: string) {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(salt()),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
	return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** HMAC of `name` + the client IP: a stable per-client key that never stores the IP. */
export async function clientKey(
	event: Pick<RequestEvent, 'request' | 'getClientAddress'>,
	name: string
) {
	// Only the platform's address (the Cloudflare adapter reads the trusted header itself). A client-sent
	// cf-connecting-ip must never pick the key.
	let ip = 'unknown';
	try {
		ip = event.getClientAddress();
	} catch {
		// prerender: no platform address
	}
	return hmac(`${name}:${ip}`);
}

/** True if allowed. Fails open (one JSON log line) if the counter is unreachable — never blocks people on our outage. */
export async function allowed(event: RequestEvent, rule: Rule) {
	const _key = await clientKey(event, rule.name);
	let reason: string;
	try {
		const { data, error } = await serviceClient().rpc('rate_take', {
			_key,
			// e2e builds sign in dozens of test users from one IP: same code path, 100× headroom.
			_limit: import.meta.env.MODE === 'e2e' ? rule.limit * 100 : rule.limit,
			_window_s: rule.windowS
		});
		if (!error) {
			// SEC-16: one denial in ten becomes a security event (a burst would otherwise flood the table).
			if (data === false && Math.random() < 0.1)
				await securityEvent('limiter_deny', { rule: rule.name }, event, _key);
			return data !== false;
		}
		reason = error.code || 'rpc';
	} catch {
		// No service-role key: normal in local dev, a misconfiguration in production.
		if (!import.meta.env.PROD) return true;
		reason = 'no-service-client';
	}
	await securityEvent('limiter_fail_open', { rule: rule.name, reason }, event);
	return true;
}
