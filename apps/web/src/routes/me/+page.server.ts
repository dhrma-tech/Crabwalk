import { THEME_COOKIE, isTheme } from '#lib/prefs.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies }) => {
	const user = await locals.getUser();
	const theme = cookies.get(THEME_COOKIE);
	const { data: roles } = user
		? await locals.supabase.from('user_roles').select('role').eq('user_id', user.id)
		: { data: [] };
	const has = (r: string) => (roles ?? []).some((x) => x.role === r);
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
		trips: trips ?? []
	};
};
