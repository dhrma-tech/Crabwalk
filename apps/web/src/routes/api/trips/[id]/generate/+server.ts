import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { session } from '#lib/server/auth.ts';
import { generateInto, isBlankTitle, planInput } from '#lib/server/planner/trips.ts';
import { loadProfile, plannerDefaults } from '#lib/server/profile.ts';
import { m } from '#lib/paraglide/messages.js';
import type { RequestHandler } from './$types';

// POST /api/trips/{id}/generate — the workspace's "Trip setup": (re)generate this trip's itinerary from the planner
// inputs. Owner and editors only (RLS on trips / trip_stops / trip_budget decides; viewers get 403).
export const POST: RequestHandler = async (event) => {
	const { user } = await session(event);
	const id = z.uuid().safeParse(event.params.id);
	if (!id.success) error(404, 'not found');
	const b = planInput.safeParse(await event.request.json().catch(() => null));
	if (!b.success) error(400, 'bad request');
	const db = event.locals.supabase;
	const { data: trip } = await db
		.from('trips')
		.select('id, title, owner_id')
		.eq('id', id.data)
		.maybeSingle();
	if (!trip) error(404, 'not found');
	const { data: me } = await db
		.from('trip_members')
		.select('role')
		.eq('trip_id', trip.id)
		.eq('user_id', user.id)
		.maybeSingle();
	if (trip.owner_id !== user.id && me?.role !== 'owner' && me?.role !== 'editor')
		error(403, 'only the owner and editors can change the plan');
	const { mileage } = plannerDefaults(await loadProfile(db, user.id));
	try {
		const r = await generateInto(db, trip.id, b.data, {
			mileage,
			// A blank trip takes the usual "2-day trip from …" name on its first plan; a renamed one keeps its name.
			title: isBlankTitle(trip.title)
				? m.plan_default_title({ days: b.data.days, from: b.data.start.label })
				: undefined
		});
		return json(r);
	} catch (e) {
		const code = (e as { code?: string }).code;
		error(code === '42501' ? 403 : 400, (e as Error).message);
	}
};
