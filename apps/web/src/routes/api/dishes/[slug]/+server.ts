import { error, json } from '@sveltejs/kit';
import { getDish } from '#lib/server/listings.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const d = await getDish(locals.supabase, params.slug);
	if (!d) error(404, 'not found');
	return json(d, { headers: { 'Cache-Control': 'public, max-age=300' } });
};
