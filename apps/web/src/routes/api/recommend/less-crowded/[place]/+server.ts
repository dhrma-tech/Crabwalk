import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET /api/recommend/less-crowded/:place — typically calm/empty similar places today (IST weekday).
export const GET: RequestHandler = async ({ params, locals }) => {
	const weekday = new Date(Date.now() + 5.5 * 3600e3).getUTCDay();
	const { data } = await locals.supabase.rpc('less_crowded_alternatives', {
		_slug: params.place,
		_weekday: weekday
	});
	return json(data ?? [], { headers: { 'Cache-Control': 'public, max-age=3600' } });
};
