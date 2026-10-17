import { error, json } from '@sveltejs/kit';
import { priceRows } from '#lib/server/prices.ts';
import { getStay } from '#lib/server/listings.ts';
import type { RequestHandler } from './$types';

// GET /api/stays/:slug/offers — price comparison rows, each with its source (BACKEND §13).
export const GET: RequestHandler = async ({ params, locals }) => {
	const s = await getStay(locals.supabase, params.slug);
	if (!s) error(404, 'not found');
	return json(await priceRows(s), { headers: { 'Cache-Control': 'public, max-age=300' } });
};
