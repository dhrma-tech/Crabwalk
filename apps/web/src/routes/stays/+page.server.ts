import { getLocale } from '#lib/paraglide/runtime.js';
import { listStays, names, photoUrls, type Lang } from '#lib/server/listings.ts';
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
	return {
		filters: f,
		stays: stays.map((s) => {
			const n = names(s.stay_translations);
			return { ...s, names: n, photo: s.hero ? photoUrls(s.hero, n[lang] || n.en) : null };
		})
	};
};
