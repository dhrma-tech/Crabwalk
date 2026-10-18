import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { getLocale } from '#lib/paraglide/runtime.js';
import { tripView } from '#lib/server/planner/trips.ts';
import type { Lang } from '#lib/server/listings.ts';
import type { RequestHandler } from './$types';

// GET /api/trips/:id/gmaps — Google Maps directions links per day, ≤ 10 stops each (BACKEND §10.5).
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!z.uuid().safeParse(params.id).success) error(400, 'bad request');
	const { data: t } = await locals.supabase
		.from('trips')
		.select('*, trip_stops(*)')
		.eq('id', params.id)
		.maybeSingle();
	if (!t) error(404, 'not found');
	const v = await tripView(locals.supabase, t, t.trip_stops, null, getLocale() as Lang);
	return json({ days: v.days.map((d, i) => ({ day: i + 1, links: d.links })) });
};
