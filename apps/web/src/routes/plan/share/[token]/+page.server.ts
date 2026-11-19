import { error, redirect } from '@sveltejs/kit';
import { getLocale } from '#lib/paraglide/runtime.js';
import type { Lang } from '#lib/server/listings.ts';
import { session } from '#lib/server/auth.ts';
import {
	copySharedTrip,
	fromShared,
	tripView,
	type SharedTrip
} from '#lib/server/planner/trips.ts';
import type { Actions, PageServerLoad } from './$types';

type Shared = { trip: SharedTrip; stops: Parameters<typeof tripView>[2] };
async function shared(db: App.Locals['supabase'], token: string) {
	if (!/^[0-9a-f]{32}$/.test(token)) error(404, 'not found');
	const { data } = await db.rpc('get_shared_trip', { _token: token });
	if (!data) error(404, 'not found');
	return data as Shared;
}

// Read-only shared plan (BACKEND §10.5): token link, no login, no owner data.
export const load: PageServerLoad = async ({ params, locals }) => {
	const d = await shared(locals.supabase, params.token);
	return {
		...(await tripView(locals.supabase, fromShared(d.trip), d.stops, null, getLocale() as Lang)),
		token: params.token
	};
};

export const actions: Actions = {
	// Hardening T3-06: "Copy this trip" — the viewer's own editable copy (signs in first if needed), then opens it.
	copy: async (event) => {
		const { user } = await session(event);
		const d = await shared(event.locals.supabase, event.params.token);
		const id = await copySharedTrip(event.locals.supabase, user.id, d.trip, d.stops);
		redirect(303, `/plan/${id}`);
	}
};
