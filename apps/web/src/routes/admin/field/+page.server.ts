import { getLocale } from '#lib/paraglide/runtime.js';
import { requireStaff } from '#lib/server/auth.ts';
import { tr, type Lang } from '#lib/server/listings.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const s = await requireStaff(event);
	const lang = getLocale() as Lang;
	const scoped = !s.isReviewer && !s.roles.some((r) => r.role === 'verifier' && !r.taluka_id);
	const mine = s.roles.filter((r) => r.role === 'verifier' && r.taluka_id).map((r) => r.taluka_id!);
	const [{ data: talukas }, { data: dishes }] = await Promise.all([
		event.locals.supabase.from('talukas').select('id, name_en, name_hi, name_mr').order('name_en'),
		event.locals.supabase
			.from('dishes')
			.select('id, slug, dish_translations(lang, name)')
			.order('slug')
	]);
	return {
		talukas: (talukas ?? [])
			.filter((t) => !scoped || mine.includes(t.id))
			.map((t) => ({
				id: t.id,
				name: (lang === 'hi' ? t.name_hi : lang === 'mr' ? t.name_mr : t.name_en) || t.name_en
			})),
		dishes: (dishes ?? []).map((d) => ({ id: d.id, name: tr(d.dish_translations, lang) ?? d.slug }))
	};
};
