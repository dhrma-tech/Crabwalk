import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { THEME_COOKIE, isTheme } from '#lib/prefs.ts';
import { session } from '#lib/server/auth.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies }) => {
	const user = await locals.getUser();
	const theme = cookies.get(THEME_COOKIE);
	const { data: roles } = user
		? await locals.supabase.from('user_roles').select('role').eq('user_id', user.id)
		: { data: [] };
	const has = (r: string) => (roles ?? []).some((x) => x.role === r);
	const { data: prefs } = user
		? await locals.supabase
				.from('user_preferences')
				.select('diet, budget_level, group_type')
				.eq('user_id', user.id)
				.maybeSingle()
		: { data: null };
	const { data: consents } = user
		? await locals.supabase
				.from('consents')
				.select('type, granted, revoked_at')
				.eq('user_id', user.id)
		: { data: [] };
	const { data: trips } = user
		? await locals.supabase
				.from('trips')
				.select('id, title, days, start_date, status')
				.eq('owner_id', user.id)
				.order('created_at', { ascending: false })
				.limit(50)
		: { data: [] };
	return {
		email: user?.email ?? null,
		theme: isTheme(theme) ? theme : 'system',
		isStaff: has('verifier') || has('reviewer') || has('admin'),
		isOwner: has('owner'),
		trips: trips ?? [],
		prefs: prefs ?? { diet: null, budget_level: null, group_type: null },
		dwell: (consents ?? []).some((c) => c.type === 'dwell_time' && c.granted && !c.revoked_at)
	};
};

// Preferences = Crabby's only memory (BACKEND §11.4): diet, budget level, group type.
const prefs = z.object({
	diet: z.enum(['', 'veg', 'non_veg', 'jain']),
	budget_level: z.enum(['', 'budget', 'mid', 'premium']),
	group_type: z.enum(['', 'family', 'couple', 'solo', 'friends'])
});

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
	},
	prefs: async (event) => {
		const { user } = await session(event);
		const b = prefs.safeParse(Object.fromEntries(await event.request.formData()));
		if (!b.success) return fail(400);
		const { error } = await event.locals.supabase.from('user_preferences').upsert(
			{
				user_id: user.id,
				diet: b.data.diet || null,
				budget_level: b.data.budget_level || null,
				group_type: b.data.group_type || null
			},
			{ onConflict: 'user_id' }
		);
		if (error) return fail(403);
		return { prefsSaved: true };
	}
};
