import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const query = z.object({ q: z.string().trim().min(2).max(100) });

// GET /api/map/search?q= — own DB first (FRONTEND §8, BACKEND §1.4). Ola is only asked when this is empty.
export const GET: RequestHandler = async ({ url, locals }) => {
	const q = query.safeParse(Object.fromEntries(url.searchParams));
	if (!q.success) error(400, 'bad query');
	const { data, error: err } = await locals.supabase.rpc('map_search', { q: q.data.q });
	if (err) error(502, 'search unavailable');
	return json(data, { headers: { 'Cache-Control': 'public, max-age=300' } });
};
