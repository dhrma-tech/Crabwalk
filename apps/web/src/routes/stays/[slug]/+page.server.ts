import { error } from '@sveltejs/kit';
import { getLocale } from '#lib/paraglide/runtime.js';
import { getStay, names, photoUrls, tr, type Lang } from '#lib/server/listings.ts';
import { priceRows } from '#lib/server/prices.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const s = await getStay(locals.supabase, params.slug);
	if (!s) error(404, 'not found');
	const lang = getLocale() as Lang;
	const n = names(s.stay_translations);
	return {
		stay: {
			id: s.id,
			names: n,
			description: tr(s.stay_translations, lang, 'description'),
			vibes: s.vibe_tags,
			style: s.service_style,
			amenities: (s.amenities ?? {}) as Record<string, boolean>,
			network: (s.network_strength ?? {}) as Record<string, string>,
			food: (s.food_at_stay ?? {}) as Record<string, boolean>,
			phone: s.phone,
			whatsapp: s.whatsapp,
			verified: s.is_verified,
			claimed: !!s.owner_id,
			lastVerified: s.last_verified_at,
			photos: s.photos.map((p) => photoUrls(p, n[lang] || n.en))
		},
		prices: await priceRows(s)
	};
};
