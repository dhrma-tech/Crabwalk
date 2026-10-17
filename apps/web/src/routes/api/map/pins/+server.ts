import { error, json } from '@sveltejs/kit';
import { pinsQuery, toFeatures } from '#lib/server/map.ts';
import type { RequestHandler } from './$types';

// GET /api/map/pins?bbox=minLon,minLat,maxLon,maxLat&kinds=place,stay&categories=beach&open_now=1 (BACKEND §14)
export const GET: RequestHandler = async ({ url, locals }) => {
	const q = pinsQuery.safeParse(Object.fromEntries(url.searchParams));
	if (!q.success) error(400, 'bad query');
	const [min_lon, min_lat, max_lon, max_lat] = q.data.bbox;
	const { data, error: err } = await locals.supabase.rpc('map_pins', {
		min_lon,
		min_lat,
		max_lon,
		max_lat,
		kinds: q.data.kinds,
		categories: q.data.categories,
		open_now: q.data.open_now === '1'
	});
	if (err) error(502, 'pins unavailable');
	// open_now depends on the clock, so keep the cache short.
	return json(toFeatures(data), { headers: { 'Cache-Control': 'public, max-age=60' } });
};
