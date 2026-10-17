import { error, fail } from '@sveltejs/kit';
import { getLocale } from '#lib/paraglide/runtime.js';
import { session } from '#lib/server/auth.ts';
import { tr, type Lang } from '#lib/server/listings.ts';
import { claim, claimInput } from '#lib/server/owner.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	await session(event);
	const c = claimInput.safeParse(event.params);
	if (!c.success) error(404, 'not found');
	const db = event.locals.supabase;
	const { data } =
		c.data.type === 'stay'
			? await db
					.from('stays')
					.select('stay_translations(lang, name)')
					.eq('id', c.data.id)
					.maybeSingle()
			: await db
					.from('eateries')
					.select('eatery_translations(lang, name)')
					.eq('id', c.data.id)
					.maybeSingle();
	if (!data) error(404, 'not found');
	const rows =
		'stay_translations' in data
			? data.stay_translations
			: (data as { eatery_translations: { lang: string; name: string }[] }).eatery_translations;
	return { name: tr(rows, getLocale() as Lang) };
};

export const actions: Actions = {
	default: async (event) => {
		const { user } = await session(event);
		const c = claimInput.safeParse(event.params);
		if (!c.success) error(404, 'not found');
		try {
			await claim(event.locals.supabase, user, c.data);
		} catch {
			return fail(400, { error: true });
		}
		return { sent: true };
	}
};
