import { error, json } from '@sveltejs/kit';
import { getStay } from '#lib/server/listings.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const s = await getStay(locals.supabase, params.slug);
	if (!s) error(404, 'not found');
	return json(s, { headers: { 'Cache-Control': 'public, max-age=300' } });
};
