import { json } from '@sveltejs/kit';
import { listStays } from '#lib/server/listings.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const q = url.searchParams;
	return json(
		await listStays(locals.supabase, {
			vibe: q.get('vibe') ?? undefined,
			style: q.get('style') ?? undefined,
			maxPrice: Number(q.get('max_price')) || undefined,
			amenity: q.get('amenity') ?? undefined
		}),
		{ headers: { 'Cache-Control': 'public, max-age=300' } }
	);
};
