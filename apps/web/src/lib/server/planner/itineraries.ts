// Ready-made itineraries (team, BACKEND §10.7) + approved custom routes (PLAN P7 task 10). Public via RLS.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/db.types.ts';
import { tr, type Lang } from '../listings.ts';

type DB = SupabaseClient<Database>;

export async function listItineraries(db: DB, lang: Lang = 'en', limit = 30) {
	const { data: approved } = await db
		.from('published_routes')
		.select('trip_id')
		.eq('status', 'approved');
	const community = (approved ?? []).map((r) => r.trip_id);
	let q = db
		.from('trips')
		.select('id, slug, title, days, pace, is_ready_made, trip_stops(kind, entity_id, day, order)')
		.order('is_ready_made', { ascending: false })
		.order('created_at', { ascending: false })
		.limit(limit);
	q = community.length
		? q.or(`is_ready_made.eq.true,id.in.(${community.join(',')})`)
		: q.eq('is_ready_made', true);
	const { data } = await q;
	const placeIds = [
		...new Set(
			(data ?? []).flatMap((t) =>
				t.trip_stops.filter((s) => s.kind === 'place').map((s) => s.entity_id)
			)
		)
	];
	const { data: places } = placeIds.length
		? await db.from('places').select('id, slug, place_translations(lang, name)').in('id', placeIds)
		: { data: [] };
	const name = new Map((places ?? []).map((p) => [p.id, tr(p.place_translations, lang) ?? p.slug]));
	return (data ?? []).map((t) => {
		const stops = [...t.trip_stops]
			.filter((s) => s.kind === 'place')
			.sort((a, b) => a.day - b.day || a.order - b.order);
		return {
			id: t.id,
			href: `/itineraries/${t.slug ?? t.id}`,
			title: t.title,
			days: t.days,
			pace: t.pace,
			readyMade: t.is_ready_made,
			places: stops.length,
			highlights: stops
				.slice(0, 3)
				.map((s) => name.get(s.entity_id))
				.filter(Boolean) as string[]
		};
	});
}
