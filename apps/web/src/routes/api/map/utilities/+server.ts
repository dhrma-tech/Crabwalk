import { error, json } from '@sveltejs/kit';
import { toFeatures, utilitiesQuery } from '#lib/server/map.ts';
import type { RequestHandler } from './$types';

// GET /api/map/utilities?bbox=…&types=fuel,hospital (BACKEND §14)
export const GET: RequestHandler = async ({ url, locals }) => {
	const q = utilitiesQuery.safeParse(Object.fromEntries(url.searchParams));
	if (!q.success) error(400, 'bad query');
	const [min_lon, min_lat, max_lon, max_lat] = q.data.bbox;
	const { data, error: err } = await locals.supabase.rpc('map_utilities', {
		min_lon,
		min_lat,
		max_lon,
		max_lat,
		types: q.data.types
	});
	if (err) error(502, 'utilities unavailable');
	return json(toFeatures(data), { headers: { 'Cache-Control': 'public, max-age=3600' } });
};
