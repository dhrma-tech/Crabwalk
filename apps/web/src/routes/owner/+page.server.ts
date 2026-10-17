import { getLocale } from '#lib/paraglide/runtime.js';
import { session } from '#lib/server/auth.ts';
import { tr, type Lang } from '#lib/server/listings.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const s = await session(event);
	const lang = getLocale() as Lang;
	const db = event.locals.supabase;
	const own = s.roles.filter((r) => r.role === 'owner' && r.entity_id);
	const ids = (t: string) => own.filter((r) => r.entity_type === t).map((r) => r.entity_id!);
	const [st, ea, claims] = await Promise.all([
		db.from('stays').select('id, stay_translations(lang, name)').in('id', ids('stay')),
		db.from('eateries').select('id, eatery_translations(lang, name)').in('id', ids('eatery')),
		db
			.from('owner_claims')
			.select('id, entity_type, status')
			.eq('user_id', s.user.id)
			.eq('status', 'pending')
	]);
	return {
		listings: [
			...(st.data ?? []).map((x) => ({
				type: 'stay',
				id: x.id,
				name: tr(x.stay_translations, lang)
			})),
			...(ea.data ?? []).map((x) => ({
				type: 'eatery',
				id: x.id,
				name: tr(x.eatery_translations, lang)
			}))
		],
		pending: claims.data?.length ?? 0
	};
};
