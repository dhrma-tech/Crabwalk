import { error } from '@sveltejs/kit';
import { OLA_PROXY_URL } from '$app/env/private';
import type { RequestHandler } from './$types';

// Same-origin /ola/* → services/ola-proxy (BACKEND §6.1). Signed-in users only (B11); the proxy verifies the
// token itself and holds the key. Responses are never cached server-side or stored.
export const GET: RequestHandler = async ({ params, url, locals, fetch }) => {
	if (params.endpoint !== 'autocomplete' && params.endpoint !== 'directions')
		error(404, 'not found');
	const user = await locals.getUser();
	if (!user) error(401, 'sign in');
	const { data } = await locals.supabase.auth.getSession();
	if (!data.session) error(401, 'sign in');
	if (!OLA_PROXY_URL) error(503, 'search unavailable');

	const res = await fetch(`${OLA_PROXY_URL}/ola/${params.endpoint}${url.search}`, {
		headers: { Authorization: `Bearer ${data.session.access_token}` }
	});
	return new Response(res.body, {
		status: res.status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }
	});
};
