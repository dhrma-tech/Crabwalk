import { json } from '@sveltejs/kit';
import { getLocale } from '#lib/paraglide/runtime.js';
import { listItineraries } from '#lib/server/planner/itineraries.ts';
import type { Lang } from '#lib/server/listings.ts';
import type { RequestHandler } from './$types';

// GET /api/itineraries — ready-made itineraries + approved custom routes (public).
export const GET: RequestHandler = async ({ locals }) =>
	json(await listItineraries(locals.supabase, getLocale() as Lang), {
		headers: { 'Cache-Control': 'public, max-age=300' }
	});
