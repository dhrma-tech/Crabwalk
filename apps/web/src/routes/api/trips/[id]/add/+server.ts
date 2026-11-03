import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { session } from '#lib/server/auth.ts';
import { addToDay, listingId } from '#lib/server/planner/workspace.ts';
import type { RequestHandler } from './$types';

// POST /api/trips/:id/add { type, slug, day } — "Add to trip" from a listing page (DECISIONS T-4 / T-47).
// A place joins the day's stops, food joins as a meal, a stay becomes that night's stay (replacing any other).
// Places and meals go before the night's stay. Then the trip is re-timed like any edit: stops that no longer fit
// their hours are flagged on the plan, never dropped. Owner only (RLS); the listing must be published.
const body = z.object({
	type: z.enum(['place', 'stay', 'eatery']),
	slug: z.string().min(1).max(200),
	day: z.number().int().min(1).max(7)
});

export const POST: RequestHandler = async (event) => {
	await session(event);
	const b = body.safeParse(await event.request.json().catch(() => null));
	if (!z.uuid().safeParse(event.params.id).success || !b.success) error(400, 'bad request');
	const db = event.locals.supabase;
	const [{ data: trip }, id] = await Promise.all([
		db.from('trips').select('id').eq('id', event.params.id).maybeSingle(),
		listingId(db, b.data.type, b.data.slug)
	]);
	if (!trip || !id) error(404, 'not found');
	if (!(await addToDay(db, event.params.id, b.data.type, id, b.data.day)))
		error(409, 'trip cannot take this');
	return json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
};
