import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { getLocale } from '#lib/paraglide/runtime.js';
import type { Lang } from '#lib/server/listings.ts';
import { tripRoutes } from '#lib/server/planner/trips.ts';
import type { RequestHandler } from './$types';

// GET /api/trips/:id/routes — every leg's stored route (shape + turn cues) for navigation. The service worker
// keeps the last copy so a saved trip navigates offline (FRONTEND §9).
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!z.uuid().safeParse(params.id).success) error(404, 'not found');
	const r = await tripRoutes(locals.supabase, params.id, getLocale() as Lang);
	if (!r) error(404, 'not found');
	return json(r, { headers: { 'Cache-Control': 'private, no-cache' } });
};
