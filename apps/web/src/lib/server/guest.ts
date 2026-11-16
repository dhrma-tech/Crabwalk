import type { Handle } from '@sveltejs/kit/hooks';
import type { User } from '@supabase/supabase-js';
import { building } from '$app/env';
import { devBypass } from '#lib/devAuth.server.ts';
import { gateAdmin, tempGate } from './gate.ts';

// TODO(before-deploy): restore full auth — temporary access gate (docs/RESTORE_AUTH.md). AUTH_MODE=temp_email_gate.
// Hardening 2026-11 (SEC-02): the server never mints guest sessions. A visitor browses read-only with no session;
// the browser creates the anonymous session (lib/guest.client.ts, behind Turnstile) the first time they save,
// vote, plan or chat. Here only: a temp-admin session whose signed admin cookie is gone, expired or off the
// allowlist is signed out.
export const guestGate: Handle = async ({ event, resolve }) => {
	if (!tempGate() || building || devBypass(event.url.hostname)) return resolve(event);
	const base = event.locals.getUser;
	let user: Promise<User | null> | undefined;
	event.locals.getUser = () =>
		(user ??= (async () => {
			const u = await base();
			if (u?.app_metadata?.temp_admin && !(await gateAdmin(event))) {
				await event.locals.supabase.auth.signOut({ scope: 'local' });
				return null;
			}
			return u;
		})());
	return resolve(event);
};
