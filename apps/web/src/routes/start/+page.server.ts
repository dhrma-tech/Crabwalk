import { CODE_RE } from '#lib/server/qr.ts';
import { lonLat, nearby } from '#lib/server/listings.ts';
import type { PageServerLoad } from './$types';

// Station/bus-stand landing (FRONTEND §7.17). Ready-made itineraries arrive in P7 (DECISIONS P6-3).
export const load: PageServerLoad = async ({ url, locals }) => {
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
};
