import { error } from '@sveltejs/kit';
import { getLocale } from '#lib/paraglide/runtime.js';
import { getEatery, names, photoUrls, tr, type Lang } from '#lib/server/listings.ts';
import { ratingsFor, DIMENSIONS } from '#lib/server/ratings.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const e = await getEatery(locals.supabase, params.slug);
	if (!e) error(404, 'not found');
	const lang = getLocale() as Lang;
	const n = names(e.eatery_translations);
	const apps = Object.entries(
		(e.food_apps ?? {}) as Record<string, { available?: boolean; link?: string }>
	)
		.filter(([, v]) => v?.available && v.link && /^https:\/\//.test(v.link))
		.map(([app, v]) => ({ app, link: v.link! }));
	return {
		eatery: {
			id: e.id,
			names: n,
			description: tr(e.eatery_translations, lang, 'description'),
			authenticity: e.authenticity,
			priceForTwo: e.price_for_two,
			diet: (['veg', 'non_veg', 'jain'] as const).filter(
				(k) => (e.diet_flags as Record<string, boolean>)?.[k]
			),
			menu: ((e.menu as { items?: string[] } | null)?.items ?? []).filter(Boolean),
			apps,
			hours: e.eatery_hours,
			phone: e.phone,
			whatsapp: e.whatsapp,
			verified: e.is_verified,
			claimed: !!e.owner_id,
			lastVerified: e.last_verified_at,
			dishes: e.eatery_dishes
				.filter((d) => d.dishes)
				.map((d) => ({
					slug: d.dishes!.slug,
					name: tr(d.dishes!.dish_translations, lang) ?? d.dishes!.slug,
					signature: d.is_signature
				})),
			photos: e.photos.map((p) => photoUrls(p, n[lang] || n.en))
		},
		ratings: await ratingsFor(
			locals.supabase,
			'eatery',
			e.id,
			(await locals.getUser())?.id ?? null
		),
		dims: DIMENSIONS.eatery
	};
};
