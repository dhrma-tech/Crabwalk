// TODO(before-deploy): restore full auth — temporary access gate (docs/RESTORE_AUTH.md).
// AUTH_MODE=temp_email_gate: guests use the app with no sign-in (anonymous Supabase sessions, hooks.server.ts) and
// admins type an email from ADMIN_EMAILS plus the team passcode (ADMIN_PASSCODE). The allowlist, the passcode and
// the HMAC secret never leave the server. The admin
// cookie is `<payload>.<hmac>`: base64url JSON {e: email, x: expiry ms, i: issued-at ms}, HMAC-SHA256 with
// ADMIN_SESSION_SECRET. Hardening 2026-11 (SEC-08): 24 hours, `__Host-` name on https, and ADMIN_SESSION_EPOCH
// (ms) revokes every cookie issued before it.
import type { Cookies, RequestEvent } from '@sveltejs/kit';
import {
	ADMIN_EMAILS,
	ADMIN_PASSCODE,
	ADMIN_SESSION_EPOCH,
	ADMIN_SESSION_SECRET,
	AUTH_MODE
} from '$app/env/private';

export const ADMIN_COOKIE = 'cw_admin';
/** On https: the browser only accepts it Secure, for the whole site, from this host (no Domain). */
export const ADMIN_COOKIE_HOST = '__Host-cw_admin';
export const ADMIN_TTL_MS = 24 * 60 * 60 * 1000;

export const tempGate = () => AUTH_MODE === 'temp_email_gate';

export const normEmail = (e: string) => e.trim().toLowerCase();
export const parseAllowlist = (raw: string | undefined) =>
	(raw ?? '')
		.split(',')
		.map(normEmail)
		.filter((e) => e.includes('@'));
export const onAllowlist = (email: string, list: string[]) => list.includes(normEmail(email));

const enc = new TextEncoder();
const b64url = (b: ArrayBuffer | Uint8Array) =>
	btoa(String.fromCharCode(...new Uint8Array(b)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
const unb64url = (s: string) =>
	Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function hmacKey(secret: string) {
	return crypto.subtle.importKey(
		'raw',
		enc.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify']
	);
}

/** Signed cookie value for `email`, valid for 24 hours from `now`. */
export async function signAdmin(email: string, secret: string, now = Date.now()) {
	const payload = b64url(
		enc.encode(JSON.stringify({ e: normEmail(email), x: now + ADMIN_TTL_MS, i: now }))
	);
	const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(payload));
	return `${payload}.${b64url(sig)}`;
}

/**
 * The admin email when the cookie is genuine, unexpired, issued at or after `epoch` (when one is set) and the
 * email is still on the allowlist; else null.
 */
export async function verifyAdmin(
	value: string | undefined,
	secret: string,
	list: string[],
	now = Date.now(),
	epoch = 0
) {
	if (!value || !secret) return null;
	const [payload, sig, extra] = value.split('.');
	if (!payload || !sig || extra !== undefined) return null;
	try {
		const ok = await crypto.subtle.verify(
			'HMAC',
			await hmacKey(secret),
			unb64url(sig),
			enc.encode(payload)
		);
		if (!ok) return null;
		const { e, x, i } = JSON.parse(new TextDecoder().decode(unb64url(payload))) as {
			e?: unknown;
			x?: unknown;
			i?: unknown;
		};
		if (typeof e !== 'string' || typeof x !== 'number' || x <= now) return null;
		// Cookies from before the epoch (and older cookies without `i`) stop working once an epoch is set.
		if (epoch > 0 && (typeof i !== 'number' || i < epoch)) return null;
		return onAllowlist(e, list) ? e : null;
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------- bound to this deployment's env

const secret = () => ADMIN_SESSION_SECRET ?? '';
export const isAdminEmail = (email: string) => onAllowlist(email, parseAllowlist(ADMIN_EMAILS));

/** Constant-time passcode check (both sides HMAC'd first). No passcode configured → nobody gets in. */
export async function passcodeMatches(given: string, expected: string | undefined, key: string) {
	if (!expected || !key || typeof given !== 'string') return false;
	const k = await hmacKey(key);
	const [a, b] = await Promise.all([
		crypto.subtle.sign('HMAC', k, enc.encode(given)),
		crypto.subtle.sign('HMAC', k, enc.encode(expected))
	]);
	const x = new Uint8Array(a);
	const y = new Uint8Array(b);
	let diff = 0;
	for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
	return diff === 0;
}
/** Email on the allowlist AND the team passcode. Both are always checked (no early exit on the email). */
export async function adminCredentials(email: string, passcode: string) {
	const pass = await passcodeMatches(passcode, ADMIN_PASSCODE, secret() || 'no-secret');
	return isAdminEmail(email) && pass;
}

/** Admin email from the request cookie (temp mode only), or null. Server-side check for every admin route. */
export async function gateAdmin(event: Pick<RequestEvent, 'cookies'>) {
	if (!tempGate()) return null;
	// Both names during the move to `__Host-` (SEC-08).
	const value = event.cookies.get(ADMIN_COOKIE_HOST) ?? event.cookies.get(ADMIN_COOKIE);
	return verifyAdmin(value, secret(), parseAllowlist(ADMIN_EMAILS), Date.now(), epoch());
}
const epoch = () => Number(ADMIN_SESSION_EPOCH) || 0;
const local = (url: URL) => url.hostname === 'localhost' || url.hostname === '127.0.0.1';

/** `__Host-cw_admin` on https; plain `cw_admin` only on http://localhost (dev, e2e). Secure everywhere else. */
export async function setAdminCookie(cookies: Cookies, email: string, url: URL) {
	if (!secret()) throw new Error('ADMIN_SESSION_SECRET not set');
	const https = url.protocol === 'https:';
	cookies.set(https ? ADMIN_COOKIE_HOST : ADMIN_COOKIE, await signAdmin(email, secret()), {
		path: '/',
		httpOnly: true,
		secure: https || !local(url),
		sameSite: 'lax',
		maxAge: ADMIN_TTL_MS / 1000
	});
	if (https) cookies.delete(ADMIN_COOKIE, { path: '/' });
}

export const clearAdminCookie = (cookies: Cookies, url: URL) => {
	cookies.delete(ADMIN_COOKIE, { path: '/', secure: !local(url) });
	if (url.protocol === 'https:') cookies.delete(ADMIN_COOKIE_HOST, { path: '/', secure: true });
};

// Crawlers get no anonymous account (they never keep the cookie, so each visit would make a new user).
export const isBot = (ua: string | null) =>
	!ua || /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|curl|wget/i.test(ua);
