import { error } from '@sveltejs/kit';
import { getLocale } from '#lib/paraglide/runtime.js';
import { getDish, names, photoUrls, tr, type Lang } from '#lib/server/listings.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const d = await getDish(locals.supabase, params.dish);
	if (!d) error(404, 'not found');
	const lang = getLocale() as Lang;
	const name = tr(d.dish_translations, lang) ?? d.slug;
	return {
		dish: {
			name,
			names: names(d.dish_translations),
			what: tr(d.dish_translations, lang, 'what_it_is'),
			story: tr(d.dish_translations, lang, 'story'),
			photo: d.photos[0] ? photoUrls(d.photos[0], name) : null,
			eateries: d.eatery_dishes
				.sort((a, b) => Number(b.is_best_for) - Number(a.is_best_for))
				.map((x) => ({
					slug: x.eateries!.slug,
					name: tr(x.eateries!.eatery_translations, lang) ?? x.eateries!.slug,
					best: x.is_best_for,
					priceForTwo: x.eateries!.price_for_two
				}))
		}
	};
};
