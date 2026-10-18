import { error, json } from '@sveltejs/kit';
import { bbox } from '#lib/server/map.ts';
import type { RequestHandler } from './$types';

// GET /api/map/heatmap?bbox= — "Busy now": every point says whether it is Live or Typical (G10).
export const GET: RequestHandler = async ({ url, locals }) => {
	const b = bbox.safeParse(url.searchParams.get('bbox'));
	if (!b.success) error(400, 'bad query');
	const [min_lon, min_lat, max_lon, max_lat] = b.data;
	const { data, error: err } = await locals.supabase.rpc('map_heatmap', {
		min_lon,
		min_lat,
		max_lon,
		max_lat
	});
	if (err) error(502, 'heatmap unavailable');
	return json(
		{
			type: 'FeatureCollection',
			features: (data ?? []).map((p) => ({
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
				properties: { slug: p.slug, weight: p.weight, source: p.source }
			}))
		},
		{ headers: { 'Cache-Control': 'public, max-age=120' } }
	);
};
