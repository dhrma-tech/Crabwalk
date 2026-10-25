import { json } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import type { User } from '@supabase/supabase-js';
import { NOT_SAVED, NOT_SAVED_HEADER, devBypass } from '#lib/devAuth.ts';

export { devBypass };

// Cookie-only writes (language/theme) and sign-in/out still go through.
const PASS_WRITES = ['/prefs', '/login'];

// Nil UUID so queries keyed by user id come back empty instead of erroring.
export const DEV_USER = {
	id: '00000000-0000-0000-0000-000000000000',
	aud: 'authenticated',
	email: 'dev@crabwalk.local',
	created_at: '1970-01-01T00:00:00Z',
	app_metadata: {},
	user_metadata: {
		name: 'Dev User',
		role: 'verifier',
		language: 'en',
		preferences: { veg: false, budget: 'medium', groupType: 'friends' }
	}
} satisfies User;

// Every staff role, so verifier, reviewer and admin screens all open.
export const DEV_ROLES = ['verifier', 'reviewer', 'admin'].map((role) => ({
	role,
	taluka_id: null,
	entity_type: null,
	entity_id: null
}));

let warned = false;

/** Server: signed in as DEV_USER; writes never reach the database. */
export const devAuth: Handle = async ({ event, resolve }) => {
	if (!devBypass(event.url.hostname)) return resolve(event);
	if (!warned) console.warn('DEV AUTH BYPASS ACTIVE');
	warned = true;
	event.locals.getUser = async () => DEV_USER;

	const { method } = event.request;
	const path = event.url.pathname;
	if (method === 'POST' && path === '/api/ai/chat')
		return json({
			kind: 'answer',
			reply: 'Dev mode reply — Crabby is not called while the auth bypass is on.',
			actions: [],
			alternatives: [],
			remaining: 99
		});
	if (method === 'GET' || method === 'HEAD' || PASS_WRITES.includes(path)) return resolve(event);

	const headers = { [NOT_SAVED_HEADER]: '1' };
	// Enhanced form action: a failure result with no data (devalue for undefined).
	if (event.request.headers.has('x-sveltekit-action'))
		return json({ type: 'failure', status: 409, data: '-1' }, { headers });
	// Plain form post: back to the page; the layout shows the toast.
	if (event.request.headers.get('accept')?.includes('text/html')) {
		const back = event.request.headers.get('referer');
		const to = back?.startsWith(event.url.origin) ? back.split('#')[0] : '/';
		return new Response(null, { status: 303, headers: { location: `${to}#dev-not-saved` } });
	}
	return json({ message: NOT_SAVED }, { status: 409, headers });
};
