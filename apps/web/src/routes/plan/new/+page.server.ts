import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { session } from '#lib/server/auth.ts';
import { blankTrip } from '#lib/server/planner/trips.ts';
import type { PageServerLoad } from './$types';

// Plan (nav): no onboarding steps. Open the traveller's empty draft trip (or a new one) straight in the workspace;
// its "Trip setup" section asks the planner questions on one screen and generates the itinerary there.
// A page route (not an endpoint) so the client router doesn't match /plan/[id] with id "new". An empty draft is
// reused, so a link preload never piles up trips.
export const load: PageServerLoad = async (event) => {
	const { user } = await session(event);
	const id = await blankTrip(event.locals.supabase, user.id);
	redirect(303, resolve('/plan/[id]', { id }));
};
