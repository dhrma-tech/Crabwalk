import { error, json } from '@sveltejs/kit';
import { getEatery } from '#lib/server/listings.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const e = await getEatery(locals.supabase, params.slug);
	if (!e) error(404, 'not found');
	return json(e, { headers: { 'Cache-Control': 'public, max-age=300' } });
};
