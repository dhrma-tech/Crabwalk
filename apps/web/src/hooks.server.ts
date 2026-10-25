import { createServerClient } from '@supabase/ssr';
import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import { sequence } from '@sveltejs/kit/hooks';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '$app/env/public';
import type { Database } from '#lib/db.types.ts';
import { devAuth } from '#lib/devAuth.server.ts';
import { paraglideMiddleware } from '#lib/paraglide/server.js';
import { THEME_COOKIE, isTheme } from '#lib/prefs.ts';
import { allowed, ruleFor } from '#lib/server/rate.ts';
import { isPrivatePath } from '#lib/seo.ts';

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
	event.locals.getUser = async () => {
		const { data, error } = await event.locals.supabase.auth.getUser();
		return error ? null : data.user;
	};

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
	const rule = ruleFor(event.request.method, event.url);
	if (rule && !(await allowed(event, rule)))
		return new Response(JSON.stringify({ message: 'too many requests' }), {
			status: 429,
			headers: { 'Content-Type': 'application/json', 'Retry-After': String(rule.windowS) }
		});
	const res = await resolve(event);
	const h = res.headers;
	h.set('X-Content-Type-Options', 'nosniff');
	h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	h.set(
		'Permissions-Policy',
		'geolocation=(self), camera=(self), microphone=(self), payment=(), usb=()'
	);
	h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	if (!h.has('X-Frame-Options')) h.set('X-Frame-Options', 'DENY');
	if (isPrivatePath(event.url.pathname)) h.set('X-Robots-Tag', 'noindex');
	return res;
};

export const handle = sequence(shell, supabase, devAuth, limits);

// Unexpected errors (thrown by our code): details go to the server log under a short id and the user sees only
// that id. error() and framework errors (404s) keep SvelteKit's safe defaults — no stack traces either way.
export const handleError: HandleServerError = ({ kind, error, event }) => {
	if (kind !== 'unknown') return;
	const id = crypto.randomUUID().slice(0, 8);
	console.error(`[${id}] ${event.request.method} ${event.url.pathname}`, error);
	return { id };
};
