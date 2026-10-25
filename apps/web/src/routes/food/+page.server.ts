import { getLocale } from '#lib/paraglide/runtime.js';
import { listEateries, names, photoUrls, tr, type Lang } from '#lib/server/listings.ts';
import { eateryFilter, readFilter } from '#lib/server/filters.ts';
import { cardAggs } from '#lib/server/ratings.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const lang = getLocale() as Lang;
	const p = readFilter(eateryFilter, url.searchParams)!;
	const f = { diet: p.diet, authenticity: p.authenticity, maxPrice: p.max_price };
	const eateries = await listEateries(locals.supabase, f);
	const aggs = await cardAggs(
		locals.supabase,
		'eatery',
		eateries.map((e) => e.id)
	);
	return {
		filters: f,
		eateries: eateries.map((e) => {
			const n = names(e.eatery_translations);
			const sig = e.eatery_dishes.find((d) => d.is_signature)?.dishes;
			return {
				slug: e.slug,
				agg: aggs.get(e.id) ?? null,
				names: n,
				authenticity: e.authenticity,
				priceForTwo: e.price_for_two,
				diet: (['veg', 'non_veg', 'jain'] as const).filter(
					(k) => (e.diet_flags as Record<string, boolean>)?.[k]
				),
				signature: sig ? tr(sig.dish_translations, lang) : null,
				photo: e.hero ? photoUrls(e.hero, n[lang] || n.en) : null
			};
		})
	};
};
