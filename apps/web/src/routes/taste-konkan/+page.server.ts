import { getLocale } from '#lib/paraglide/runtime.js';
import { listDishes, photoUrls, tr, type Lang } from '#lib/server/listings.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const lang = getLocale() as Lang;
	const dishes = await listDishes(locals.supabase);
	return {
		dishes: dishes.map((d) => {
			const name = tr(d.dish_translations, lang) ?? d.slug;
			return {
				slug: d.slug,
				name,
				what: tr(d.dish_translations, lang, 'what_it_is'),
				photo: d.hero ? photoUrls(d.hero, name) : null
			};
		})
	};
};
