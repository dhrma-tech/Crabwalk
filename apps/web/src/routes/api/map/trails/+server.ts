import { error, json } from '@sveltejs/kit';
import { bbox } from '#lib/server/map.ts';
import type { RequestHandler } from './$types';

// GET /api/map/trails?bbox= — trails with difficulty (P9-1) and source (OSM unverified vs team-checked).
export const GET: RequestHandler = async ({ url, locals }) => {
	const b = bbox.safeParse(url.searchParams.get('bbox'));
	if (!b.success) error(400, 'bad query');
	const [min_lon, min_lat, max_lon, max_lat] = b.data;
	const { data, error: err } = await locals.supabase.rpc('map_trails', {
		min_lon,
		min_lat,
		max_lon,
		max_lat
	});
	if (err) error(502, 'trails unavailable');
	return json(
		{
			type: 'FeatureCollection',
			features: (data ?? []).map(({ geojson, ...p }) => ({
				type: 'Feature',
				geometry: JSON.parse(geojson),
				properties: p
			}))
		},
		{ headers: { 'Cache-Control': 'public, max-age=3600' } }
	);
};
