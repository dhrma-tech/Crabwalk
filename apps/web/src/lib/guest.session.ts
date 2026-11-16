// The heavy half of lib/guest.client.ts (SEC-02): Turnstile and the anonymous sign-in. Loaded on demand, the
// first time a visitor needs a session, so none of it sits in the app shell (200 KB budget).
// No supabase-js here: any on-demand path from the shell to supabase-js makes the bundler move its CommonJS
// helper out of the main chunk into one more shell request. The browser calls Supabase Auth's sign-up endpoint
// itself (so Auth's per-IP limits and CAPTCHA see the visitor, not our server) and hands the new session to
// POST /auth/guest, which writes the usual auth cookies.
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '$app/env/public';
import { m } from '#lib/paraglide/messages.js';

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
export async function captchaToken(
	sitekey: string | null | undefined
): Promise<string | undefined> {
	if (!sitekey) return undefined;
	const ts = await loadTurnstile();
	const box = document.createElement('div');
	// Bottom centre, above the nav: visible only for the rare interactive challenge.
	box.style.cssText =
		'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:60;max-width:100vw';
	box.setAttribute('role', 'status');
	box.setAttribute('aria-label', m.guest_ready());
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

let pending: Promise<boolean> | undefined;
/** Create a guest session. Resolves false if it could not be created (offline, challenge failed). */
export function ensureSession(sitekey: string | null | undefined): Promise<boolean> {
	return (pending ??= (async () => {
		try {
			const token = await captchaToken(sitekey);
			// Same request supabase-js signInAnonymously() makes.
			const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					apikey: SUPABASE_ANON_KEY ?? '',
					authorization: `Bearer ${SUPABASE_ANON_KEY ?? ''}`
				},
				body: JSON.stringify({
					data: {},
					...(token ? { gotrue_meta_security: { captcha_token: token } } : {})
				})
			});
			if (!r.ok) return false;
			const s = (await r.json()) as { access_token?: string; refresh_token?: string };
			if (!s.access_token || !s.refresh_token) return false;
			const set = await fetch('/auth/guest', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ access_token: s.access_token, refresh_token: s.refresh_token })
			});
			return set.ok;
		} catch {
			return false;
		}
	})().finally(() => (pending = undefined)));
}
