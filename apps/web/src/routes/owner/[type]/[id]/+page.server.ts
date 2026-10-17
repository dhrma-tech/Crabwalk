import { error } from '@sveltejs/kit';
import { getLocale } from '#lib/paraglide/runtime.js';
import { session } from '#lib/server/auth.ts';
import { tr, type Lang } from '#lib/server/listings.ts';
import type { PageServerLoad } from './$types';

// Owner edit: facts only. The page exists only for the owner of this listing.
export const load: PageServerLoad = async (event) => {
	const s = await session(event);
	const { type, id } = event.params;
	if (type !== 'stay' && type !== 'eatery') error(404, 'not found');
	if (!s.roles.some((r) => r.role === 'owner' && r.entity_type === type && r.entity_id === id))
		error(403, 'not allowed');
	const lang = getLocale() as Lang;
	const db = event.locals.supabase;
	if (type === 'stay') {
		const { data } = await db
			.from('stays')
			.select('price_min, price_max, phone, whatsapp, stay_translations(lang, name)')
			.eq('id', id)
			.single();
		return { type, id, name: tr(data?.stay_translations, lang), stay: data, eatery: null };
	}
	const { data } = await db
		.from('eateries')
		.select(
			'price_for_two, menu, phone, whatsapp, eatery_hours(*), eatery_translations(lang, name)'
		)
		.eq('id', id)
		.single();
	return { type, id, name: tr(data?.eatery_translations, lang), stay: null, eatery: data };
};
