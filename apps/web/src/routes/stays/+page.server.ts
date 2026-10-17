import { getLocale } from '#lib/paraglide/runtime.js';
import { listStays, names, photoUrls, type Lang } from '#lib/server/listings.ts';
import { cardAggs } from '#lib/server/ratings.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const lang = getLocale() as Lang;
	const f = {
		vibe: url.searchParams.get('vibe') || undefined,
		style: url.searchParams.get('style') || undefined,
		maxPrice: Number(url.searchParams.get('max_price')) || undefined,
		amenity: url.searchParams.get('amenity') || undefined
	};
	const stays = await listStays(locals.supabase, f);
	const aggs = await cardAggs(
		locals.supabase,
		'stay',
		stays.map((s) => s.id)
	);
	return {
		filters: f,
		stays: stays.map((s) => {
			const n = names(s.stay_translations);
			return {
				...s,
				agg: aggs.get(s.id) ?? null,
				names: n,
				photo: s.hero ? photoUrls(s.hero, n[lang] || n.en) : null
			};
		})
	};
};
