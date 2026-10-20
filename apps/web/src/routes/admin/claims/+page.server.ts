import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { getLocale } from '#lib/paraglide/runtime.js';
import { requireStaff } from '#lib/server/auth.ts';
import { tr, type Lang } from '#lib/server/listings.ts';
import type { Actions, PageServerLoad } from './$types';

// Owner claims (G5): admin calls the listed number, then approves → owner role for that listing only.
export const load: PageServerLoad = async (event) => {
	await requireStaff(event, 'admin');
	const lang = getLocale() as Lang;
	const db = event.locals.supabase;
	const { data: claims } = await db
		.from('owner_claims')
		.select('*')
		.eq('status', 'pending')
		.order('created_at');
	const ids = (t: string) =>
		(claims ?? []).filter((c) => c.entity_type === t).map((c) => c.entity_id);
	const [s, e] = await Promise.all([
		db
			.from('stays')
			.select('id, phone, whatsapp, stay_translations(lang, name)')
			.in('id', ids('stay')),
		db
			.from('eateries')
			.select('id, phone, whatsapp, eatery_translations(lang, name)')
			.in('id', ids('eatery'))
	]);
	const info = new Map<string, { name: string | null; phone: string | null }>([
		...(s.data ?? []).map(
			(x) => [x.id, { name: tr(x.stay_translations, lang), phone: x.phone ?? x.whatsapp }] as const
		),
		...(e.data ?? []).map(
			(x) =>
				[x.id, { name: tr(x.eatery_translations, lang), phone: x.phone ?? x.whatsapp }] as const
		)
	]);
	return {
		claims: (claims ?? []).map((c) => ({
			id: c.id,
			type: c.entity_type,
			email: c.email,
			...(info.get(c.entity_id) ?? { name: null, phone: null })
		}))
	};
};

export const actions: Actions = {
	review: async (event) => {
		await requireStaff(event, 'admin');
		const f = await event.request.formData();
		if (!z.uuid().safeParse(f.get('id')).success) return fail(400);
		const { error } = await event.locals.supabase.rpc('review_owner_claim', {
			_claim: String(f.get('id')),
			_approve: f.get('approve') === '1'
		});
		if (error) return fail(400);
	}
};
