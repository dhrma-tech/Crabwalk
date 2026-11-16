// Guest sessions, created in the browser on first need (hardening 2026-11, SEC-02).
// TODO(before-deploy): restore full auth — only used while the temp gate is on (layout data `gate.on`).
// The server no longer mints an anonymous user on page views. The first save, vote, plan or chat calls
// ensureSession(): it signs in anonymously, with a Cloudflare Turnstile token when TURNSTILE_SITE_KEY is set
// (Supabase Auth then refuses sign-ups without one). Bots and no-JS visitors browse read-only.
// This module is in the app shell (hearts, Crabby), so it stays tiny: Turnstile and the sign-in live in
// guest.session.ts, loaded on first need. The Turnstile site key arrives in the layout data
// (gate.captcha), not from $app/env/public.
import { page } from '$app/state';
import { signInPath } from '#lib/login.ts';

const gate = () => (page.data as { gate?: { on?: boolean; captcha?: string | null } }).gate ?? {};
const heavy = () => import('./guest.session.ts');

/** A Turnstile token, or undefined when no site key is configured (local dev, e2e). */
export const captchaToken = async () => (await heavy()).captchaToken(gate().captcha);

/** True while the temp gate is on (guests need no sign-in page). */
export const guestMode = () => !!gate().on;

/** Make sure this browser has a session. Resolves false if it could not be created (offline, challenge failed). */
export const ensureSession = async (): Promise<boolean> => {
	const sitekey = gate().captcha;
	return heavy().then(
		(m) => m.ensureSession(sitekey),
		() => false
	);
};

/**
 * Run a request that needs a session. On 401 in guest mode: create the guest session and retry once.
 * Outside guest mode the 401 is returned for the caller's own sign-in handling.
 */
export async function withSession(fetcher: () => Promise<Response>): Promise<Response> {
	const res = await fetcher();
	if (res.status !== 401 || !guestMode() || !(await ensureSession())) return res;
	return fetcher();
}

/** Where a signed-out visitor goes to get a session and come back: /guest in guest mode, /login otherwise. */
export const signInHref = (here: { pathname: string; search: string }) =>
	signInPath(here, guestMode());
