import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET /api/me/token (SEC-10): the access token for the plan page's Realtime connection. The auth cookies are
// httpOnly, so the browser client cannot read the session itself. The user is checked with the auth server
// first; the token is never cached.
export const GET: RequestHandler = async ({ locals }) => {
	if (!(await locals.getUser())) error(401, 'sign in');
	const {
		data: { session }
	} = await locals.supabase.auth.getSession();
	if (!session) error(401, 'sign in');
	return json(
		{ token: session.access_token },
		{ headers: { 'Cache-Control': 'private, no-store' } }
	);
};
