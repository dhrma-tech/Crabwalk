import { error, json } from '@sveltejs/kit';
import { bbox } from '#lib/server/map.ts';
import type { RequestHandler } from './$types';

// GET /api/map/alerts?bbox= — active road/ghat/landslide/closure alerts (auto-expire, G9).
export const GET: RequestHandler = async ({ url, locals }) => {
	const b = bbox.safeParse(url.searchParams.get('bbox'));
	if (!b.success) error(400, 'bad query');
	const [min_lon, min_lat, max_lon, max_lat] = b.data;
	const { data, error: err } = await locals.supabase.rpc('map_alerts', {
		min_lon,
		min_lat,
		max_lon,
		max_lat
	});
	if (err) error(502, 'alerts unavailable');
	return json(
		{
			type: 'FeatureCollection',
			features: (data ?? []).map(({ geojson, ...p }) => ({
				type: 'Feature',
				geometry: JSON.parse(geojson),
				properties: p
			}))
		},
		{ headers: { 'Cache-Control': 'public, max-age=60' } }
	);
};
