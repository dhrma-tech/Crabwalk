import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { lonLat, photosFor, photoUrls } from '#lib/server/listings.ts';
import { cardAggs } from '#lib/server/ratings.ts';
import type { RequestHandler } from './$types';

const query = z.object({
	kind: z.enum(['place', 'stay', 'eatery']),
	slug: z.string().trim().min(1).max(120)
});

// GET /api/map/pin?kind=&slug= — one published pin with its hero photo and mini verdict, for the map's pin
// sheet and the place → map hand-off (Report 2 §9.3, Report 1 §4.3).
export const GET: RequestHandler = async ({ url, locals }) => {
	const q = query.safeParse(Object.fromEntries(url.searchParams));
	if (!q.success) error(400, 'bad query');
	const { kind, slug } = q.data;
	const db = locals.supabase;
	const row =
		kind === 'place'
			? (
					await db
						.from('places')
						.select('id, slug, category, tide_station_id, location, place_translations(lang, name)')
						.eq('slug', slug)
						.eq('status', 'published')
						.maybeSingle()
				).data
			: kind === 'stay'
				? (
						await db
							.from('stays')
							.select('id, slug, location, stay_translations(lang, name)')
							.eq('slug', slug)
							.eq('status', 'published')
							.maybeSingle()
					).data
				: (
						await db
							.from('eateries')
							.select('id, slug, location, eatery_translations(lang, name)')
							.eq('slug', slug)
							.eq('status', 'published')
							.maybeSingle()
					).data;
	const at = row && lonLat(row.location);
	if (!row || !at) error(404, 'not found');
	const tr = (
		'place_translations' in row
			? row.place_translations
			: 'stay_translations' in row
				? row.stay_translations
				: row.eatery_translations
	) as { lang: string; name: string }[];
	const name = (l: string) => tr.find((t) => t.lang === l)?.name ?? null;
	const [photos, aggs] = await Promise.all([
		photosFor(db, kind, [row.id]),
		cardAggs(db, kind, [row.id])
	]);
	const hero = photos.get(row.id)?.[0];
	return json(
		{
			kind,
			id: row.id,
			slug: row.slug,
			name_en: name('en'),
			name_hi: name('hi'),
			name_mr: name('mr'),
			category: 'category' in row ? row.category : null,
			tide_station_id: 'tide_station_id' in row ? row.tide_station_id : null,
			lon: at[0],
			lat: at[1],
			photo: hero ? photoUrls(hero, name('en') ?? row.slug) : null,
			agg: aggs.get(row.id) ?? null
		},
		{ headers: { 'Cache-Control': 'public, max-age=60' } }
	);
};
