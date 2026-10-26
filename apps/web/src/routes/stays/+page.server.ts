import { getLocale } from '#lib/paraglide/runtime.js';
import { listStays, names, photoUrls, type Lang } from '#lib/server/listings.ts';
import { stayFilter, readFilter } from '#lib/server/filters.ts';
import { cardAggs } from '#lib/server/ratings.ts';
import { readSort, sortListings } from '#lib/sort.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const lang = getLocale() as Lang;
	const p = readFilter(stayFilter, url.searchParams)!;
	const f = { vibe: p.vibe, style: p.style, maxPrice: p.max_price, amenity: p.amenity };
	const sort = readSort(url.searchParams.get('sort'));
	const stays = await listStays(locals.supabase, f);
	const aggs = await cardAggs(
		locals.supabase,
		'stay',
		stays.map((s) => s.id)
	);
	const rows = stays.map((s) => {
		const n = names(s.stay_translations);
		return {
			...s,
			agg: aggs.get(s.id) ?? null,
			names: n,
			name: n[lang] || n.en,
			photo: s.hero ? photoUrls(s.hero, n[lang] || n.en) : null
		};
	});
	return {
		filters: f,
		sort,
		stays: sortListings(rows, sort, (s) => ({ low: s.price_min, high: s.price_max }))
	};
};
