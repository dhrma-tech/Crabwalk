import { createServerClient } from '@supabase/ssr';
import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import type { User } from '@supabase/supabase-js';
import { sequence } from '@sveltejs/kit/hooks';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '$app/env/public';
import type { Database } from '#lib/db.types.ts';
import { devAuth } from '#lib/devAuth.server.ts';
// TODO(before-deploy): restore full auth — temp access gate (docs/RESTORE_AUTH.md).
import { guestGate } from '#lib/server/guest.ts';
import { tempGate } from '#lib/server/gate.ts';
import { paraglideMiddleware } from '#lib/paraglide/server.js';
import { THEME_COOKIE, isTheme } from '#lib/prefs.ts';
import { allowed, rulesFor } from '#lib/server/rate.ts';
import { takeAiBudget } from '#lib/server/aiBudget.ts';
import { setBudget } from '#lib/server/ai/router.ts';
import { isPrivatePath } from '#lib/seo.ts';
import { log, securityEvent } from '#lib/server/log.ts';

// SEC-11: every model call first takes from the global daily budget (and respects the kill switch).
setBudget(takeAiBudget);

// SEC-16: one short id per request, on every log line it causes and on unexpected-error references.
const requestId: Handle = ({ event, resolve }) => {
	event.locals.rid = crypto.randomUUID().slice(0, 8);
	return resolve(event);
};

const supabase: Handle = async ({ event, resolve }) => {
	if (!SUPABASE_URL || !SUPABASE_ANON_KEY)
		throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY not set');

	event.locals.supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookies) =>
				cookies.forEach(({ name, value, options }) =>
					event.cookies.set(name, value, { ...options, path: '/' })
				)
		}
	});

	// getUser() validates the JWT with the auth server; never trust getSession() alone on the server.
	// Memoised per request: several loads ask, and the temp gate below may create a guest session once.
	let user: Promise<User | null> | undefined;
	event.locals.getUser = () =>
		(user ??= event.locals.supabase.auth
			.getUser()
			.then(({ data, error }) => (error ? null : data.user)));

	return resolve(event, {
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version'
	});
};

// Locale (cookie → Accept-Language → en) and manual theme override, rendered server-side so there's no flash.
const shell: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ locale }) => {
		const theme = event.cookies.get(THEME_COOKIE);
		const themeAttr = isTheme(theme) ? ` data-theme="${theme}"` : '';
		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html.replace('%paraglide.lang%', locale).replace('%crabwalk.theme%', themeAttr)
		});
	});

// P10: per-client limits on write endpoints (429 with Retry-After), then security headers on every response.
const limits: Handle = async ({ event, resolve }) => {
	for (const rule of rulesFor(event.request.method, event.url))
		if (!(await allowed(event, rule)))
			return new Response(JSON.stringify({ message: 'too many requests' }), {
				status: 429,
				headers: { 'Content-Type': 'application/json', 'Retry-After': String(rule.windowS) }
			});
	const res = await resolve(event);
	// A 429 from a route (not the limiter above): a per-user quota or daily cap was reached.
	if (res.status === 429) await securityEvent('quota_hit', { method: event.request.method }, event);
	const h = res.headers;
	h.set('X-Content-Type-Options', 'nosniff');
	h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	h.set(
		'Permissions-Policy',
		'geolocation=(self), camera=(self), microphone=(self), payment=(), usb=()'
	);
	h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	if (!h.has('X-Frame-Options')) h.set('X-Frame-Options', 'DENY');
	// SEC-24: no cross-origin window handles to our pages; our responses are not embeddable by other sites.
	h.set('Cross-Origin-Opener-Policy', 'same-origin');
	h.set('Cross-Origin-Resource-Policy', 'same-site');
	// TODO(before-deploy): restore full auth — the whole site stays out of search while the temp gate is on.
	if (tempGate()) h.set('X-Robots-Tag', 'noindex, nofollow');
	else if (isPrivatePath(event.url.pathname)) h.set('X-Robots-Tag', 'noindex');
	return res;
};

export const handle = sequence(requestId, shell, supabase, devAuth, guestGate, limits);

// Unexpected errors (thrown by our code): details go to the server log under a short id and the user sees only
// that id. error() and framework errors (404s) keep SvelteKit's safe defaults — no stack traces either way.
export const handleError: HandleServerError = ({ kind, error, event }) => {
	if (kind !== 'unknown') return;
	const id = event.locals.rid ?? crypto.randomUUID().slice(0, 8);
	log('unexpected_error', { method: event.request.method }, event, 500);
	console.error(`[${id}] ${event.request.method} ${event.url.pathname}`, error);
	return { id };
};
