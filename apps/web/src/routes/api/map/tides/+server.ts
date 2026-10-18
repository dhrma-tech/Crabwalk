import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { bbox } from '#lib/server/map.ts';
import { TIDE_ATTRIBUTION } from '#lib/tides.ts';
import type { RequestHandler } from './$types';

const istToday = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

// GET /api/map/tides?bbox=&date= — tide-dependent places with their safe-height rule and that day's extremes;
// the client recolours them along the time slider (FRONTEND §6.9). No rule or no data → "unknown".
export const GET: RequestHandler = async ({ url, locals }) => {
	const b = bbox.safeParse(url.searchParams.get('bbox'));
	const date = z.iso
		.date()
		.optional()
		.safeParse(url.searchParams.get('date') ?? undefined);
	if (!b.success || !date.success) error(400, 'bad query');
	const [min_lon, min_lat, max_lon, max_lat] = b.data;
	const day = date.data ?? istToday();
	const { data: pins } = await locals.supabase.rpc('map_pins', {
		min_lon,
		min_lat,
		max_lon,
		max_lat,
		kinds: ['place']
	});
	const tidal = (pins ?? []).filter((p) => p.tide_station_id);
	const ids = tidal.map((p) => p.id);
	const [{ data: rules }, { data: tides }] = await Promise.all([
		ids.length
			? locals.supabase
					.from('place_tide_rules')
					.select('place_id, max_safe_height_m')
					.in('place_id', ids)
			: Promise.resolve({ data: [] }),
		ids.length
			? locals.supabase
					.from('tide_cache')
					.select('station_id, extremes, provider')
					.eq('date', day)
					.in('station_id', [...new Set(tidal.map((p) => p.tide_station_id!))])
			: Promise.resolve({ data: [] })
	]);
	const rule = new Map((rules ?? []).map((r) => [r.place_id, r.max_safe_height_m]));
	const tide = new Map((tides ?? []).map((t) => [t.station_id, t]));
	const providers = new Set<string>();
	const features = tidal.map((p) => {
		const t = tide.get(p.tide_station_id!);
		if (t) providers.add(t.provider);
		return {
			type: 'Feature',
			geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
			properties: {
				slug: p.slug,
				name_en: p.name_en,
				max_safe: rule.get(p.id) ?? null,
				extremes: t?.extremes ?? null
			}
		};
	});
	return json({
		date: day,
		attribution: [...providers].map((k) => TIDE_ATTRIBUTION[k as keyof typeof TIDE_ATTRIBUTION]),
		type: 'FeatureCollection',
		features
	});
};
