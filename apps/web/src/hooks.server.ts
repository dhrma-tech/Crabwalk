import { createServerClient } from '@supabase/ssr';
import type { Handle } from '@sveltejs/kit/hooks';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '$app/env/public';
import type { Database } from '#lib/db.types.ts';

export const handle: Handle = async ({ event, resolve }) => {
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
