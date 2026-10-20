import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { getLocale } from '#lib/paraglide/runtime.js';
import { requireStaff } from '#lib/server/auth.ts';
import { tr, type Lang } from '#lib/server/listings.ts';
import type { Actions, PageServerLoad } from './$types';

// Field-team hub: monthly re-check queue (PLAN P4 task 4) + links.
export const load: PageServerLoad = async (event) => {
	const s = await requireStaff(event);
	const lang = getLocale() as Lang;
	const mine = s.roles.filter((r) => r.role === 'verifier' && r.taluka_id).map((r) => r.taluka_id!);
	let q = event.locals.supabase
		.from('places')
		.select('id, slug, next_recheck_at, last_verified_at, place_translations(lang, name)')
		.eq('status', 'published')
		.lte('next_recheck_at', new Date().toISOString())
		.order('next_recheck_at')
		.limit(50);
	if (!s.isReviewer && mine.length) q = q.in('taluka_id', mine);
	const { data } = await q;
	return {
		isReviewer: s.isReviewer,
		isAdmin: s.isAdmin,
		due: (data ?? []).map((p) => ({
			id: p.id,
			slug: p.slug,
			name: tr(p.place_translations, lang) ?? p.slug,
			last: p.last_verified_at
		}))
	};
};

export const actions: Actions = {
	verified: async (event) => {
		await requireStaff(event);
		const parsed = z.uuid().safeParse((await event.request.formData()).get('id'));
		if (!parsed.success) return fail(400);
		const id = parsed.data;
		const { error } = await event.locals.supabase
			.from('places')
			.update({ last_verified_at: new Date().toISOString() })
			.eq('id', id);
		if (error) return fail(403, { error: true });
	}
};
