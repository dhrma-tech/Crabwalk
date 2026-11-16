import { redirect } from '@sveltejs/kit';
import { safeReturnPath } from '#lib/prefs.ts';
import { tempGate } from '#lib/server/gate.ts';
import type { PageServerLoad } from './$types';

// /guest?next=<path> (SEC-02): the stop for a visitor who opened a page that needs a session while the temp gate
// is on. The page creates the guest session in the browser (Turnstile) and goes on to `next`.
// TODO(before-deploy): restore full auth — in full mode this is just a redirect to /login.
export const load: PageServerLoad = async ({ locals, url }) => {
	const raw = safeReturnPath(url.searchParams.get('next'));
	const next = raw.startsWith('/guest') ? '/' : raw;
	if (!tempGate()) redirect(303, `/login?next=${encodeURIComponent(next)}`);
	if (await locals.getUser()) redirect(303, next);
	return { next };
};
