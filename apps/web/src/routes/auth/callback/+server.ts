import { redirect } from '@sveltejs/kit';
import { NEXT_COOKIE, nextPath } from '#lib/login.ts';
import type { RequestHandler } from './$types';

// OAuth (PKCE) return: exchange the code for a session cookie, then go back where sign-in started.
export const GET: RequestHandler = async ({ url, locals, cookies }) => {
	const next = nextPath(cookies.get(NEXT_COOKIE));
	cookies.delete(NEXT_COOKIE, { path: '/auth/callback' });
	const code = url.searchParams.get('code');
	if (code) {
		const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
		if (!error) redirect(303, next ?? '/login');
	}
	redirect(303, '/login?error=oauth');
};
