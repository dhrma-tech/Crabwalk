// TODO(before-deploy): restore full auth — temporary access gate (docs/RESTORE_AUTH.md).
// AUTH_MODE=temp_email_gate: guests use the app with no sign-in (anonymous Supabase sessions, hooks.server.ts) and
// admins type an email from ADMIN_EMAILS plus the team passcode (ADMIN_PASSCODE). The allowlist, the passcode and
// the HMAC secret never leave the server. The admin
// cookie is `<payload>.<hmac>`: base64url JSON {e: email, x: expiry ms}, HMAC-SHA256 with ADMIN_SESSION_SECRET.
import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { ADMIN_EMAILS, ADMIN_PASSCODE, ADMIN_SESSION_SECRET, AUTH_MODE } from '$app/env/private';

export const ADMIN_COOKIE = 'cw_admin';
export const ADMIN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

/** Signed cookie value for `email`, valid for 7 days from `now`. */
export async function signAdmin(email: string, secret: string, now = Date.now()) {
	const payload = b64url(
		enc.encode(JSON.stringify({ e: normEmail(email), x: now + ADMIN_TTL_MS }))
	);
	const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(payload));
	return `${payload}.${b64url(sig)}`;
}

/** The admin email when the cookie is genuine, unexpired and the email is still on the allowlist; else null. */
export async function verifyAdmin(
	value: string | undefined,
	secret: string,
	list: string[],
	now = Date.now()
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
		const { e, x } = JSON.parse(new TextDecoder().decode(unb64url(payload))) as {
			e?: unknown;
			x?: unknown;
		};
		if (typeof e !== 'string' || typeof x !== 'number' || x <= now) return null;
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
	return verifyAdmin(event.cookies.get(ADMIN_COOKIE), secret(), parseAllowlist(ADMIN_EMAILS));
}

export async function setAdminCookie(cookies: Cookies, email: string, secure: boolean) {
	if (!secret()) throw new Error('ADMIN_SESSION_SECRET not set');
	cookies.set(ADMIN_COOKIE, await signAdmin(email, secret()), {
		path: '/',
		httpOnly: true,
		secure,
		sameSite: 'lax',
		maxAge: ADMIN_TTL_MS / 1000
	});
}

export const clearAdminCookie = (cookies: Cookies) => cookies.delete(ADMIN_COOKIE, { path: '/' });

// Crawlers get no anonymous account (they never keep the cookie, so each visit would make a new user).
export const isBot = (ua: string | null) =>
	!ua || /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|curl|wget/i.test(ua);
