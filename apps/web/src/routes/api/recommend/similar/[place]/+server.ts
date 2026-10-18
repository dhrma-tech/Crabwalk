import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET /api/recommend/similar/:place — embeddings + rules, no LLM (BACKEND §11.1).
export const GET: RequestHandler = async ({ params, locals }) => {
	const { data } = await locals.supabase.rpc('similar_places', { _slug: params.place, _limit: 4 });
	return json(data ?? [], { headers: { 'Cache-Control': 'public, max-age=3600' } });
};
