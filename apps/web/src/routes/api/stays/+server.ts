import { error, json } from '@sveltejs/kit';
import { listStays } from '#lib/server/listings.ts';
import { stayFilter, readFilter } from '#lib/server/filters.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const f = readFilter(stayFilter, url.searchParams, true);
	if (!f) error(400, 'bad filter');
	return json(
		await listStays(locals.supabase, {
			vibe: f.vibe,
			style: f.style,
			maxPrice: f.max_price,
			amenity: f.amenity
		}),
		{ headers: { 'Cache-Control': 'public, max-age=300' } }
	);
};
