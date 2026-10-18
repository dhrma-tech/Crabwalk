import { getLocale } from '#lib/paraglide/runtime.js';
import { CODE_RE } from '#lib/server/qr.ts';
import { lonLat, nearby, type Lang } from '#lib/server/listings.ts';
import { listItineraries } from '#lib/server/planner/itineraries.ts';
import type { PageServerLoad } from './$types';

// Station/bus-stand landing (FRONTEND §7.17): ready-made itineraries + planner CTA + what's near.
export const load: PageServerLoad = async (event) => ({
	itineraries: await listItineraries(event.locals.supabase, getLocale() as Lang, 5),
	...(await stop(event))
});

async function stop({ url, locals }: Parameters<PageServerLoad>[0]) {
	const from = url.searchParams.get('from')?.toUpperCase() ?? '';
	if (!CODE_RE.test(from)) return { stop: null, nearby: null };
	const db = locals.supabase;
	const { data: q } = await db
		.from('qr_codes')
		.select('entity_type, entity_id')
		.eq('code', from)
		.in('entity_type', ['station', 'bus_stand'])
		.maybeSingle();
	if (!q) return { stop: null, nearby: null };
	const { data: u } = await db
		.from('utility_pois')
		.select('name, type, location')
		.eq('id', q.entity_id)
		.maybeSingle();
	const c = u ? lonLat(u.location) : null;
	return {
		stop: u ? { name: u.name, type: u.type } : null,
		nearby: c ? await nearby(db, c[0], c[1]) : null
	};
}
