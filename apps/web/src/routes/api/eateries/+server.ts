import { error, json } from '@sveltejs/kit';
import { listEateries } from '#lib/server/listings.ts';
import { eateryFilter, readFilter } from '#lib/server/filters.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const f = readFilter(eateryFilter, url.searchParams, true);
	if (!f) error(400, 'bad filter');
	return json(
		await listEateries(locals.supabase, {
			diet: f.diet,
			authenticity: f.authenticity,
			maxPrice: f.max_price
		}),
		{ headers: { 'Cache-Control': 'public, max-age=300' } }
	);
};
