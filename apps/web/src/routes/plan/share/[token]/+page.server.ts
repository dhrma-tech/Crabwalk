import { error } from '@sveltejs/kit';
import { getLocale } from '#lib/paraglide/runtime.js';
import type { Lang } from '#lib/server/listings.ts';
import { fromShared, tripView, type SharedTrip } from '#lib/server/planner/trips.ts';
import type { PageServerLoad } from './$types';

// Read-only shared plan (BACKEND §10.5): token link, no login, no owner data.
export const load: PageServerLoad = async ({ params, locals }) => {
	if (!/^[0-9a-f]{32}$/.test(params.token)) error(404, 'not found');
	const { data } = await locals.supabase.rpc('get_shared_trip', { _token: params.token });
	if (!data) error(404, 'not found');
	const d = data as { trip: SharedTrip; stops: Parameters<typeof tripView>[2] };
	return {
		...(await tripView(locals.supabase, fromShared(d.trip), d.stops, null, getLocale() as Lang)),
		token: params.token
	};
};
