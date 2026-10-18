import { error, json } from '@sveltejs/kit';
import { session } from '#lib/server/auth.ts';
import { createTrip, planInput } from '#lib/server/planner/trips.ts';
import type { RequestHandler } from './$types';

// POST /api/trips/plan — deterministic plan from the inputs (BACKEND §10); creator account required.
export const POST: RequestHandler = async (event) => {
	const { user } = await session(event);
	const b = planInput.safeParse(await event.request.json().catch(() => null));
	if (!b.success) error(400, 'bad request');
	const r = await createTrip(event.locals.supabase, user.id, b.data);
	return json(r, { status: 201 });
};
