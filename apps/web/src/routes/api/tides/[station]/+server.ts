import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { TIDE_ATTRIBUTION } from '#lib/tides.ts';
import type { RequestHandler } from './$types';

const istToday = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const query = z.object({ date: z.iso.date().optional() });

// GET /api/tides/:station?date=YYYY-MM-DD (BACKEND §14). 404 = no fresh data → UI says "unavailable".
export const GET: RequestHandler = async ({ params, url, locals }) => {
	const q = query.safeParse(Object.fromEntries(url.searchParams));
	if (!q.success || !z.uuid().safeParse(params.station).success) error(400, 'bad query');
	const { data, error: err } = await locals.supabase
		.from('tide_cache')
		.select('date, extremes, provider, fetched_at')
		.eq('station_id', params.station)
		.eq('date', q.data.date ?? istToday())
		.maybeSingle();
	if (err) error(502, 'tides unavailable');
	if (!data) error(404, 'no tide data');
	return json(
		{ ...data, attribution: TIDE_ATTRIBUTION[data.provider] },
		{ headers: { 'Cache-Control': 'public, max-age=900' } }
	);
};
