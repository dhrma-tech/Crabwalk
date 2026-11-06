import { error, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { loginHref } from '#lib/login.ts';
import { DEV_ROLES, devBypass } from '#lib/devAuth.server.ts';
import { gateAdmin, tempGate } from '#lib/server/gate.ts';

export type Role = {
	role: string;
	taluka_id: string | null;
	entity_type: string | null;
	entity_id: string | null;
};

// TODO(before-deploy): restore full auth — in temp mode every allow-listed admin has every staff role, equally.
const GATE_ROLES: Role[] = ['verifier', 'reviewer', 'admin'].map((role) => ({
	role,
	taluka_id: null,
	entity_type: null,
	entity_id: null
}));

type Ev = Pick<RequestEvent, 'locals' | 'url' | 'cookies'>;

/** Signed-in user + their roles (own rows readable via RLS). Signed out → /login, then back here. */
export async function session(event: Ev) {
	const user = await event.locals.getUser();
	if (!user) {
		if (event.url.pathname.startsWith('/api/')) error(401, 'sign in');
		redirect(303, loginHref(event.url));
	}
	// TODO(before-deploy): restore full auth — temp mode: the signed admin cookie, not user_roles, grants staff.
	if (tempGate()) {
		const admin = await gateAdmin(event);
		const roles = admin ? GATE_ROLES : [];
		return { user, roles, admin, isAdmin: !!admin, isReviewer: !!admin, isVerifier: !!admin };
	}
	const { data } = await event.locals.supabase
		.from('user_roles')
		.select('role, taluka_id, entity_type, entity_id')
		.eq('user_id', user.id);
	const roles = (devBypass(event.url.hostname) ? DEV_ROLES : (data ?? [])) as Role[];
	const has = (r: string) => roles.some((x) => x.role === r);
	return {
		user,
		roles,
		admin: null as string | null,
		isAdmin: has('admin'),
		isReviewer: has('reviewer') || has('admin'),
		isVerifier: has('verifier') || has('reviewer') || has('admin')
	};
}

export async function requireStaff(
	event: Ev,
	level: 'verifier' | 'reviewer' | 'admin' = 'verifier'
) {
	const s = await session(event);
	const ok = level === 'admin' ? s.isAdmin : level === 'reviewer' ? s.isReviewer : s.isVerifier;
	if (!ok) {
		// TODO(before-deploy): restore full auth — temp mode sends people to the email gate on /me.
		if (tempGate() && !event.url.pathname.startsWith('/api/')) redirect(303, '/me?admin=1');
		error(403, 'not allowed');
	}
	return s;
}
