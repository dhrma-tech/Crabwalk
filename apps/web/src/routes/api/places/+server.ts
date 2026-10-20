import { error, json } from '@sveltejs/kit';
import { listPlaces } from '#lib/server/listings.ts';
import { placeFilter, readFilter } from '#lib/server/filters.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const f = readFilter(placeFilter, url.searchParams, true);
	if (!f) error(400, 'bad filter');
	return json(
		await listPlaces(locals.supabase, { category: f.category, hiddenGem: f.hidden_gem === '1' }),
		{ headers: { 'Cache-Control': 'public, max-age=300' } }
	);
};
