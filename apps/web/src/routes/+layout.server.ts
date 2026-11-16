import { building } from '$app/env';
import { TURNSTILE_SITE_KEY } from '$app/env/public';
import { gateAdmin, tempGate } from '#lib/server/gate.ts';
import type { LayoutServerLoad } from './$types';

// TODO(before-deploy): restore full auth — temp gate state for the header (Admin indicator, Exit admin) and the
// sign-in toggle. Only a boolean and the admin's own email reach the browser; never the allowlist.
export const load: LayoutServerLoad = async (event) => ({
	gate: {
		on: !building && tempGate(),
		admin: building ? null : await gateAdmin(event),
		// Turnstile site key (public by design): the browser needs it to create a guest session or request a code.
		captcha: TURNSTILE_SITE_KEY || null
	}
});
