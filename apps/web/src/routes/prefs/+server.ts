import { redirect } from '@sveltejs/kit';
import { cookieName, cookieMaxAge, isLocale, type Locale } from '#lib/paraglide/runtime.js';
import { MONSOON_COOKIE, THEME_COOKIE, isTheme, safeReturnPath } from '#lib/prefs.ts';
import { formBody } from '#lib/server/http.ts';
import { logEvent } from '#lib/server/analytics.ts';
import type { RequestHandler } from './$types';

// Language switch (top bar) and theme switch (Me). Plain form POST so it works without JS.
// Saved in a cookie for everyone and on the profile for signed-in users (FRONTEND §10, §12).
export const POST: RequestHandler = async (event) => {
	const { request, cookies, locals } = event;
	const form = await formBody(request);
	const locale = form.get('locale');
	const theme = form.get('theme');
	const opts = { path: '/', maxAge: cookieMaxAge, httpOnly: false, sameSite: 'lax' as const };
	const profile: { language?: Locale; theme?: 'system' | 'light' | 'dark' } = {};

	if (isLocale(locale)) {
		cookies.set(cookieName, locale, opts);
		profile.language = locale;
		void logEvent(event, 'lang_switch', { to: locale });
	}
	if (theme === 'system') {
		cookies.delete(THEME_COOKIE, { path: '/' });
		profile.theme = theme;
	} else if (isTheme(theme)) {
		cookies.set(THEME_COOKIE, theme, opts);
		profile.theme = theme;
	}
	// T3-03: monsoon mode on or off on this device (cookie only).
	const monsoon = form.get('monsoon');
	if (monsoon === 'on' || monsoon === 'off') cookies.set(MONSOON_COOKIE, monsoon, opts);

	const user = Object.keys(profile).length ? await locals.getUser() : null;
	if (user) await locals.supabase.from('profiles').update(profile).eq('id', user.id);

	redirect(303, safeReturnPath(form.get('return')));
};
