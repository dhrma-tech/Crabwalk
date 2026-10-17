import { json } from '@sveltejs/kit';
import { listPlaces } from '#lib/server/listings.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) =>
	json(
		await listPlaces(locals.supabase, {
			category: url.searchParams.get('category') ?? undefined,
			hiddenGem: url.searchParams.get('hidden_gem') === '1'
		}),
		{
			headers: { 'Cache-Control': 'public, max-age=300' }
		}
	);
