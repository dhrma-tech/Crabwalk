import { fail } from '@sveltejs/kit';
import { getLocale } from '#lib/paraglide/runtime.js';
import { requireStaff } from '#lib/server/auth.ts';
import { tr, type Lang } from '#lib/server/listings.ts';
import type { Actions, PageServerLoad } from './$types';

// Report triage (PLAN P4 task 8, B10: built once; P6 adds QR as a source). RLS scopes verifiers to their talukas.
export const load: PageServerLoad = async (event) => {
	await requireStaff(event);
	const lang = getLocale() as Lang;
	const db = event.locals.supabase;
	const { data: reports } = await db
		.from('reports')
		.select('*')
		.in('status', ['new', 'triaged'])
		.order('created_at', { ascending: false })
		.limit(100);
	const ids = (t: string) =>
		(reports ?? []).filter((r) => r.entity_type === t).map((r) => r.entity_id);
	const [p, s, e] = await Promise.all([
		db.from('places').select('id, slug, place_translations(lang, name)').in('id', ids('place')),
		db.from('stays').select('id, slug, stay_translations(lang, name)').in('id', ids('stay')),
		db.from('eateries').select('id, slug, eatery_translations(lang, name)').in('id', ids('eatery'))
	]);
	const label = new Map<string, { name: string | null; href: string }>([
		...(p.data ?? []).map(
			(x) => [x.id, { name: tr(x.place_translations, lang), href: `/place/${x.slug}` }] as const
		),
		...(s.data ?? []).map(
			(x) => [x.id, { name: tr(x.stay_translations, lang), href: `/stays/${x.slug}` }] as const
		),
		...(e.data ?? []).map(
			(x) => [x.id, { name: tr(x.eatery_translations, lang), href: `/food/${x.slug}` }] as const
		)
	]);
	return {
		reports: (reports ?? []).map((r) => ({ ...r, target: label.get(r.entity_id) ?? null }))
	};
};

export const actions: Actions = {
	status: async (event) => {
		const s = await requireStaff(event);
		const f = await event.request.formData();
		const status = String(f.get('status'));
		if (!['new', 'triaged', 'fixed', 'rejected'].includes(status)) return fail(400);
		const { error } = await event.locals.supabase
			.from('reports')
			.update({
				status: status as 'new' | 'triaged' | 'fixed' | 'rejected',
				assigned_to: s.user.id
			})
			.eq('id', String(f.get('id')));
		if (error) return fail(403);
	}
};
