import { safeReturnPath } from '#lib/prefs.ts';

// Google returns through /auth/callback, whose URL must match Supabase's redirect allow-list exactly, so the
// return path rides in a short-lived cookie instead of the redirect URL.
export const NEXT_COOKIE = 'login_next';

/** A same-origin path to return to after signing in, or null (stay on /login, "Signed in as …"). */
export const nextPath = (v: unknown) =>
	typeof v === 'string' && v !== '/login' && safeReturnPath(v) === v ? v : null;

/** Sign-in link that brings the user back to `here` (path + query) afterwards. */
export const loginHref = (here: { pathname: string; search: string }) =>
	`/login?next=${encodeURIComponent(here.pathname + here.search)}`;

/**
 * Where a signed-out visitor goes to get a session and come back. Temp gate (`guest`): /guest creates the
 * guest session in the browser (SEC-02); full auth: /login. TODO(before-deploy): restore full auth.
 */
export const signInPath = (here: { pathname: string; search: string }, guest: boolean) =>
	guest ? loginHref(here).replace('/login?', '/guest?') : loginHref(here);

/**
 * Readable companion of the httpOnly auth cookies (SEC-10): "1" while a session exists. Browser code checks it
 * to skip requests that would only answer 401; it grants nothing (the server checks the real session).
 */
export const SIGNED_IN_COOKIE = 'cw_signed_in';
export const hasSessionCookie = () =>
	typeof document !== 'undefined' && document.cookie.includes(`${SIGNED_IN_COOKIE}=1`);
