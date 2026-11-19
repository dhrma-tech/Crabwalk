import { lonLat } from '../../listings.ts';
import { obj, str, int, n, placeBySlug, read, type Args, type Ctx, type Tool } from './shared.ts';

// search_stays and search_eateries (BACKEND §11.3): one body, `name` says which.
async function search(ctx: Ctx, a: Args, name: 'search_stays' | 'search_eateries') {
	const { db, lang } = ctx;
	const { s, i } = read(a);
	const stays = name === 'search_stays';
	const near = s('near_place') ? await placeBySlug(db, s('near_place')!) : null;
	const c = near ? lonLat(near.location) : null;
	let q = stays
		? db
				.from('stays')
				.select(
					'id, slug, location, price_min, price_max, price_source, vibe_tags, amenities, stay_translations(lang, name)'
				)
				.eq('status', 'published')
				.limit(40)
		: db
				.from('eateries')
				.select(
					'id, slug, location, price_for_two, diet_flags, authenticity, eatery_translations(lang, name)'
				)
				.eq('status', 'published')
				.limit(40);
	if (stays && i('max_price')) q = q.lte('price_min', i('max_price')!);
	if (stays && s('vibe')) q = q.contains('vibe_tags', [s('vibe')!]);
	if (!stays && s('diet')) q = q.contains('diet_flags', { [s('diet')!]: true });
	if (!stays && i('max_price_for_two')) q = q.lte('price_for_two', i('max_price_for_two')!);
	const dist = (p: [number, number]) =>
		c ? Math.hypot((p[0] - c[0]) * 106, (p[1] - c[1]) * 110.6) : 0;
	if (c) {
		// Near a place: take the nearest candidates inside the 15 km box first, so the row limit
		// can't drop close listings when a region has more than 40 (DECISIONS P10a found issue).
		const dLat = 15 / 110.6;
		const dLon = 15 / 106;
		const { data: pins } = await db.rpc('map_pins', {
			min_lon: c[0] - dLon,
			min_lat: c[1] - dLat,
			max_lon: c[0] + dLon,
			max_lat: c[1] + dLat,
			kinds: [stays ? 'stay' : 'eatery']
		});
		const ids = (pins ?? [])
			.sort((a, b) => dist([a.lon, a.lat]) - dist([b.lon, b.lat]))
			.slice(0, 40)
			.map((p) => p.id);
		q = q.in('id', ids);
	}
	const { data } = await q;
	const km = (l: unknown) => {
		const p = lonLat(l);
		return c && p ? Math.round(dist(p) * 10) / 10 : null;
	};
	type Row = Record<string, unknown> & { slug: string; location: unknown };
	return ((data ?? []) as Row[])
		.map((r) => ({ r, km: km(r.location) }))
		.filter((x) => !c || (x.km ?? 99) <= 15)
		.sort((x, y) => (x.km ?? 0) - (y.km ?? 0))
		.slice(0, 6)
		.map(({ r, km }) =>
			stays
				? {
						slug: r.slug,
						name: n(r.stay_translations as never, lang),
						price_min: r.price_min,
						price_max: r.price_max,
						price_source: r.price_source,
						vibe: r.vibe_tags,
						km,
						link: `/stays/${r.slug}`
					}
				: {
						slug: r.slug,
						name: n(r.eatery_translations as never, lang),
						price_for_two: r.price_for_two,
						diet: Object.keys((r.diet_flags as Record<string, boolean>) ?? {}).filter(
							(k) => (r.diet_flags as Record<string, boolean>)[k]
						),
						authenticity: r.authenticity,
						km,
						link: `/food/${r.slug}`
					}
		);
}

export const searchStaysTool: Tool = {
	def: {
		name: 'search_stays',
		description: 'Find published stays, optionally near a place.',
		parameters: obj({
			near_place: str('Place slug'),
			max_price: int('Max nightly ₹'),
			vibe: str('Vibe tag')
		})
	},
	run: (ctx, a) => search(ctx, a, 'search_stays')
};

export const searchEateriesTool: Tool = {
	def: {
		name: 'search_eateries',
		description: 'Find published eateries, optionally near a place or by diet.',
		parameters: obj({
			near_place: str('Place slug'),
			diet: str('Diet', { enum: ['veg', 'non_veg', 'jain'] }),
			max_price_for_two: int('Max ₹ for two')
		})
	},
	run: (ctx, a) => search(ctx, a, 'search_eateries')
};
