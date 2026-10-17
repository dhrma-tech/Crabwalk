import { THEME_COOKIE, isTheme } from '#lib/prefs.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies }) => {
	const user = await locals.getUser();
	const theme = cookies.get(THEME_COOKIE);
	return { email: user?.email ?? null, theme: isTheme(theme) ? theme : 'system' };
};
