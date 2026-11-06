import { building } from '$app/env';
import { gateAdmin, tempGate } from '#lib/server/gate.ts';
import type { LayoutServerLoad } from './$types';

// TODO(before-deploy): restore full auth — temp gate state for the header (Admin indicator, Exit admin) and the
// sign-in toggle. Only a boolean and the admin's own email reach the browser; never the allowlist.
export const load: LayoutServerLoad = async (event) => ({
	gate: {
		on: !building && tempGate(),
		admin: building ? null : await gateAdmin(event)
	}
});
