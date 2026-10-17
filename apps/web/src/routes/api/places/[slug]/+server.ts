import { error, json } from '@sveltejs/kit';
import { getPlace } from '#lib/server/listings.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const p = await getPlace(locals.supabase, params.slug);
	if (!p) error(404, 'not found');
	return json(p, { headers: { 'Cache-Control': 'public, max-age=300' } });
};
