// Guest sessions, created in the browser on first need (hardening 2026-11, SEC-02).
// TODO(before-deploy): restore full auth — only used while the temp gate is on (layout data `gate.on`).
// The server no longer mints an anonymous user on page views. The first save, vote, plan or chat calls
// ensureSession(): it signs in anonymously, with a Cloudflare Turnstile token when TURNSTILE_SITE_KEY is set
// (Supabase Auth then refuses sign-ups without one). Bots and no-JS visitors browse read-only.
// The Turnstile site key arrives in the layout data (gate.captcha) and the Supabase client is imported on
// demand: this module is shared by every card (hearts), so it must not pull supabase-js into those chunks, and
// a dynamic import of $app/env/public breaks Kit's public-env chunk (it is then evaluated before the env exists).
import { page } from '$app/state';
import { loginHref } from '#lib/login.ts';

type Turnstile = {
	render: (
		el: HTMLElement,
		opts: {
			sitekey: string;
			appearance?: 'always' | 'execute' | 'interaction-only';
			callback: (token: string) => void;
			'error-callback': () => void;
			'timeout-callback'?: () => void;
		}
	) => string;
	remove: (id: string) => void;
};
const gate = () => (page.data as { gate?: { on?: boolean; captcha?: string | null } }).gate ?? {};
const API = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let script: Promise<Turnstile> | undefined;
const loadTurnstile = () =>
	(script ??= new Promise<Turnstile>((ok, fail) => {
		const s = document.createElement('script');
		s.src = API;
		s.async = true;
		s.onload = () => ok((window as unknown as { turnstile: Turnstile }).turnstile);
		s.onerror = () => {
			script = undefined;
			fail(new Error('turnstile blocked'));
		};
		document.head.appendChild(s);
	}));

/**
 * A Turnstile token, or undefined when no site key is configured (local dev, e2e: no widget, no token).
 * The widget shows only if Cloudflare wants an interaction; otherwise the token arrives unseen.
 */
export async function captchaToken(): Promise<string | undefined> {
	const sitekey = gate().captcha;
	if (!sitekey) return undefined;
	const ts = await loadTurnstile();
	const box = document.createElement('div');
	// Bottom centre, above the nav: visible only for the rare interactive challenge.
	box.style.cssText =
		'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:60;max-width:100vw';
	document.body.appendChild(box);
	let id = '';
	try {
		return await new Promise<string>((ok, fail) => {
			const timer = setTimeout(() => fail(new Error('turnstile timeout')), 60_000);
			const stop = (f: () => void) => () => (clearTimeout(timer), f());
			id = ts.render(box, {
				sitekey,
				appearance: 'interaction-only',
				callback: (t) => stop(() => ok(t))(),
				'error-callback': stop(() => fail(new Error('turnstile error'))),
				'timeout-callback': stop(() => fail(new Error('turnstile timeout')))
			});
		});
	} finally {
		if (id) ts.remove(id);
		box.remove();
	}
}

/** True while the temp gate is on (guests need no sign-in page). */
export const guestMode = () => !!gate().on;

let pending: Promise<boolean> | undefined;
/** Make sure this browser has a session. Resolves false if it could not be created (offline, challenge failed). */
export function ensureSession(): Promise<boolean> {
	return (pending ??= (async () => {
		try {
			const auth = (await import('#lib/supabase.ts')).browserClient().auth;
			if ((await auth.getSession()).data.session) return true;
			const token = await captchaToken();
			const { data, error } = await auth.signInAnonymously(
				token ? { options: { captchaToken: token } } : undefined
			);
			return !error && !!data.session;
		} catch {
			return false;
		}
	})().finally(() => (pending = undefined)));
}

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
	guestMode() ? loginHref(here).replace('/login?', '/guest?') : loginHref(here);
