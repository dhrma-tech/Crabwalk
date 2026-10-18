import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET /api/trips/share/:token — read-only shared trip (no owner, no token in the payload).
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!/^[0-9a-f]{32}$/.test(params.token)) error(400, 'bad request');
	const { data, error: err } = await locals.supabase.rpc('get_shared_trip', {
		_token: params.token
	});
	if (err) error(502, 'unavailable');
	if (!data) error(404, 'not found');
	return json(data);
};
