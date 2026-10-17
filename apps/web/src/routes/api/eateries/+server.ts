import { json } from '@sveltejs/kit';
import { listEateries } from '#lib/server/listings.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const q = url.searchParams;
	return json(
		await listEateries(locals.supabase, {
			diet: q.get('diet') ?? undefined,
			authenticity: q.get('authenticity') ?? undefined,
			maxPrice: Number(q.get('max_price')) || undefined
		}),
		{ headers: { 'Cache-Control': 'public, max-age=300' } }
	);
};
