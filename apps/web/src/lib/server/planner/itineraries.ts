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
		.select(
			'id, slug, title, days, pace, is_ready_made, trip_stops(kind, entity_id, day, order), trip_budget(stay, food, fuel, entry, activities)'
		)
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
		const b = t.trip_budget;
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
			// Place stops per day, for the card's mini route line (Discover, Report 2 §9.1).
			perDay: Array.from({ length: t.days }, (_, d) => stops.filter((s) => s.day === d + 1).length),
			budget: b ? b.stay + b.food + b.fuel + b.entry + b.activities || null : null,
			highlights: stops
				.slice(0, 3)
				.map((s) => name.get(s.entity_id))
				.filter(Boolean) as string[]
		};
	});
}

/** Trending pairs and underrated places from saved/completed trips (BACKEND §10.6; analytics, no LLM). */
export async function patterns(db: DB, lang: Lang = 'en') {
	const { data: rows } = await db
		.from('route_stats')
		.select('kind, stops, score')
		.order('score', { ascending: false });
	const ids = [...new Set((rows ?? []).flatMap((r) => r.stops))];
	const { data: places } = ids.length
		? await db
				.from('places')
				.select('id, slug, place_translations(lang, name)')
				.in('id', ids)
				.eq('status', 'published')
		: { data: [] };
	const p = new Map(
		(places ?? []).map((x) => [
			x.id,
			{ slug: x.slug, name: tr(x.place_translations, lang) ?? x.slug }
		])
	);
	const pick = (kind: string) =>
		(rows ?? [])
			.filter((r) => r.kind === kind && r.stops.every((id) => p.has(id)))
			.slice(0, 5)
			.map((r) => r.stops.map((id) => p.get(id)!));
	return { trending: pick('trending'), underrated: pick('underrated').map((x) => x[0]!) };
}
