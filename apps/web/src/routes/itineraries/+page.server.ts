import { getLocale } from '#lib/paraglide/runtime.js';
import type { Lang } from '#lib/server/listings.ts';
import { listItineraries } from '#lib/server/planner/itineraries.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	itineraries: await listItineraries(locals.supabase, getLocale() as Lang)
});
