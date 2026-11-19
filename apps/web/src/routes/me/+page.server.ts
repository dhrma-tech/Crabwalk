import { fail } from '@sveltejs/kit';
import { THEME_COOKIE, isTheme } from '#lib/prefs.ts';
import { getLocale } from '#lib/paraglide/runtime.js';
import { session } from '#lib/server/auth.ts';
import { tr, type Lang } from '#lib/server/listings.ts';
import { DEV_ROLES, devBypass } from '#lib/devAuth.server.ts';
import { gateAdmin, tempGate } from '#lib/server/gate.ts';
import type { Actions, PageServerLoad } from './$types';

// Saved listings (T-5 / T-46), newest first, named in the page language; unpublished ones drop out (RLS).
async function savedList(db: App.Locals['supabase']) {
	const { data } = await db
		.from('saved_items')
		.select('entity_type, entity_id')
		.order('created_at', { ascending: false });
	const rows = data ?? [];
	const ids = (t: string) => rows.filter((r) => r.entity_type === t).map((r) => r.entity_id);
	const [p, s, e] = await Promise.all([
		db.from('places').select('id, slug, place_translations(lang, name)').in('id', ids('place')),
		db.from('stays').select('id, slug, stay_translations(lang, name)').in('id', ids('stay')),
		db.from('eateries').select('id, slug, eatery_translations(lang, name)').in('id', ids('eatery'))
	]);
	const lang = getLocale() as Lang;
	const by = new Map<string, { name: string; href: string }>([
		...(p.data ?? []).map(
			(x) =>
				[
					x.id,
					{ name: tr(x.place_translations, lang) ?? x.slug, href: `/place/${x.slug}` }
				] as const
		),
		...(s.data ?? []).map(
			(x) =>
				[x.id, { name: tr(x.stay_translations, lang) ?? x.slug, href: `/stays/${x.slug}` }] as const
		),
		...(e.data ?? []).map(
			(x) =>
				[
					x.id,
					{ name: tr(x.eatery_translations, lang) ?? x.slug, href: `/food/${x.slug}` }
				] as const
		)
	]);
	return rows.flatMap((r) => {
		const l = by.get(r.entity_id);
		return l ? [{ type: r.entity_type, ...l }] : [];
	});
}

// T3-04 (F1): one stamp per place the user checked in at (verified_visits, own rows by RLS), dated by the first
// visit, newest first.
async function stampList(db: App.Locals['supabase']) {
	const { data } = await db
		.from('verified_visits')
		.select('entity_id, created_at')
		.eq('entity_type', 'place')
		.order('created_at', { ascending: true })
		.limit(500);
	const first = new Map<string, string>();
	for (const v of data ?? []) if (!first.has(v.entity_id)) first.set(v.entity_id, v.created_at);
	if (!first.size) return [];
	const { data: places } = await db
		.from('places')
		.select('id, slug, place_translations(lang, name)')
		.in('id', [...first.keys()]);
	const lang = getLocale() as Lang;
	return (places ?? [])
		.map((p) => ({
			slug: p.slug,
			name: tr(p.place_translations, lang) ?? p.slug,
			date: first.get(p.id)!
		}))
		.sort((a, b) => b.date.localeCompare(a.date));
}

export const load: PageServerLoad = async ({ locals, cookies, url }) => {
	// TODO(before-deploy): restore full auth — temp mode: guests are anonymous users; staff = the signed admin cookie.
	const gate = tempGate();
	const admin = gate ? await gateAdmin({ cookies }) : null;
	const user = await locals.getUser();
	const theme = cookies.get(THEME_COOKIE);
	const { data: roles } = devBypass(url.hostname)
		? { data: DEV_ROLES }
		: user
			? await locals.supabase.from('user_roles').select('role').eq('user_id', user.id)
			: { data: [] };
	const has = (r: string) => (roles ?? []).some((x) => x.role === r);
	const { data: consents } = user
		? await locals.supabase
				.from('consents')
				.select('type, granted, revoked_at')
				.eq('user_id', user.id)
		: { data: [] };
	// Own trips and the ones you were invited to (P11 §6).
	const { data: joined } = user
		? await locals.supabase.from('trip_members').select('trip_id').eq('user_id', user.id)
		: { data: [] };
	const { data: trips } = user
		? await locals.supabase
				.from('trips')
				.select('id, title, days, start_date, status')
				.or(
					[`owner_id.eq.${user.id}`, ...(joined ?? []).map((j) => `id.eq.${j.trip_id}`)].join(',')
				)
				.order('created_at', { ascending: false })
				.limit(50)
		: { data: [] };
	const [saved, stamps] = user
		? await Promise.all([savedList(locals.supabase), stampList(locals.supabase)])
		: [[], []];
	return {
		email: user?.email || null,
		signedIn: !!user,
		// SEC-15: a guest (anonymous session) is told where their trips and saves live.
		guest: !!user?.is_anonymous,
		saved,
		stamps,
		theme: isTheme(theme) ? theme : 'system',
		isStaff: gate ? !!admin : has('verifier') || has('reviewer') || has('admin'),
		isOwner: has('owner'),
		trips: trips ?? [],
		dwell: (consents ?? []).some((c) => c.type === 'dwell_time' && c.granted && !c.revoked_at)
	};
};

export const actions: Actions = {
	// Dwell-time opt-in (DPDPA consent, revocable any time; PLAN P9 acceptance).
	dwell: async (event) => {
		const { user } = await session(event);
		const on = (await event.request.formData()).get('on') === '1';
		const now = new Date().toISOString();
		const { error } = await event.locals.supabase.from('consents').upsert(
			on
				? {
						user_id: user.id,
						type: 'dwell_time',
						granted: true,
						granted_at: now,
						revoked_at: null
					}
				: { user_id: user.id, type: 'dwell_time', granted: false, revoked_at: now },
			{ onConflict: 'user_id,type' }
		);
		if (error) return fail(403);
	}
};
