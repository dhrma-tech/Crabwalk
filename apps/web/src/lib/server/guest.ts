import type { Handle } from '@sveltejs/kit/hooks';
import type { User } from '@supabase/supabase-js';
import { building } from '$app/env';
import { devBypass } from '#lib/devAuth.server.ts';
import { gateAdmin, isBot, tempGate } from './gate.ts';

// TODO(before-deploy): restore full auth — temporary access gate (docs/RESTORE_AUTH.md). AUTH_MODE=temp_email_gate:
// a visitor with no session gets a Supabase anonymous one the first time any code asks for the user, so every
// signed-in feature (saves, trips, chat, votes, reviews, journal, the AI daily cap) works under RLS as before.
// Crawlers get none. A temp-admin session whose signed admin cookie is gone, expired or off the allowlist is
// signed out first.
export const guestGate: Handle = async ({ event, resolve }) => {
	if (!tempGate() || building || devBypass(event.url.hostname)) return resolve(event);
	const base = event.locals.getUser;
	const ua = event.request.headers.get('user-agent');
	let user: Promise<User | null> | undefined;
	event.locals.getUser = () =>
		(user ??= (async () => {
			let u = await base();
			if (u?.app_metadata?.temp_admin && !(await gateAdmin(event))) {
				await event.locals.supabase.auth.signOut({ scope: 'local' });
				u = null;
			}
			if (!u && !isBot(ua)) {
				const { data, error } = await event.locals.supabase.auth.signInAnonymously();
				if (error) console.warn('guest session not created:', error.message);
				u = data.user ?? null;
			}
			return u;
		})());
	// First page view: start the guest session now, so client-side checks (saved.svelte.ts reads the auth cookie)
	// see a signed-in visitor before any server load has asked.
	const { method, headers } = event.request;
	if (method === 'GET' && headers.get('accept')?.includes('text/html'))
		await event.locals.getUser();
	return resolve(event);
};
