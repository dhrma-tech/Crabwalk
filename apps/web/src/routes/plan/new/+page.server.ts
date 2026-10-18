import { lonLat } from '#lib/server/listings.ts';
import { addDays, istToday } from '#lib/server/planner/data.ts';
import type { PageServerLoad } from './$types';

// Planner input (FRONTEND §7.8). Start points = railway stations + bus stands (DECISIONS P7-10).
export const load: PageServerLoad = async ({ locals }) => {
	const user = await locals.getUser();
	if (!user) return { signedIn: false as const, starts: [], tomorrow: '' };
	const { data } = await locals.supabase
		.from('utility_pois')
		.select('name, type, location')
		.in('type', ['railway_station', 'bus_stand'])
		.not('name', 'is', null)
		.order('type', { ascending: false })
		.order('name')
		.limit(1000);
	// One entry per name (OSM often has duplicate stops); the datalist picks by label.
	const starts = [
		...new Map(
			(data ?? []).flatMap((u) => {
				const c = lonLat(u.location);
				return c
					? [[u.name!, { label: u.name!, type: u.type, lon: c[0], lat: c[1] }] as const]
					: [];
			})
		).values()
	];
	return { signedIn: true as const, starts, tomorrow: addDays(istToday(), 1).date };
};
