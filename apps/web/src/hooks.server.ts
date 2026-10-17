import { createServerClient } from '@supabase/ssr';
import type { Handle } from '@sveltejs/kit/hooks';
import { sequence } from '@sveltejs/kit/hooks';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '$app/env/public';
import type { Database } from '#lib/db.types.ts';
import { paraglideMiddleware } from '#lib/paraglide/server.js';
import { THEME_COOKIE, isTheme } from '#lib/prefs.ts';

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

export const handle = sequence(shell, supabase);
