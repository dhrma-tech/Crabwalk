import { fail, redirect } from '@sveltejs/kit';
import { getLocale } from '#lib/paraglide/runtime.js';
import { requireStaff } from '#lib/server/auth.ts';
import { tr, type Lang } from '#lib/server/listings.ts';
import type { Actions, PageServerLoad } from './$types';

// Review queue: listings waiting for approval + dishes without published text.
export const load: PageServerLoad = async (event) => {
	await requireStaff(event, 'reviewer');
	const lang = getLocale() as Lang;
	const db = event.locals.supabase;
	const [p, s, e, d] = await Promise.all([
		db
			.from('places')
			.select('id, place_translations(lang, name), created_at')
			.eq('status', 'in_review')
			.order('created_at'),
		db
			.from('stays')
			.select('id, stay_translations(lang, name), created_at')
			.eq('status', 'in_review')
			.order('created_at'),
		db
			.from('eateries')
			.select('id, eatery_translations(lang, name), created_at')
			.eq('status', 'in_review')
			.order('created_at'),
		db.from('dishes').select('id, slug, dish_translations(lang, name)').order('slug')
	]);
	return {
		items: [
			...(p.data ?? []).map((x) => ({
				type: 'place',
				id: x.id,
				name: tr(x.place_translations, lang)
			})),
			...(s.data ?? []).map((x) => ({
				type: 'stay',
				id: x.id,
				name: tr(x.stay_translations, lang)
			})),
			...(e.data ?? []).map((x) => ({
				type: 'eatery',
				id: x.id,
				name: tr(x.eatery_translations, lang)
			}))
		],
		dishes: (d.data ?? []).map((x) => ({
			id: x.id,
			slug: x.slug,
			name: tr(x.dish_translations, lang)
		}))
	};
};

export const actions: Actions = {
	dish: async (event) => {
		await requireStaff(event, 'reviewer');
		const slug = String((await event.request.formData()).get('slug') ?? '')
			.trim()
			.toLowerCase();
		if (!/^[a-z][a-z0-9_-]{1,40}$/.test(slug)) return fail(400, { dishError: true });
		const { data, error } = await event.locals.supabase
			.from('dishes')
			.insert({ slug })
			.select('id')
			.single();
		if (error) return fail(400, { dishError: true });
		redirect(303, `/admin/review/dish/${data.id}`);
	}
};
