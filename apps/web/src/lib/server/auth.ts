import { error, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export type Role = {
	role: string;
	taluka_id: string | null;
	entity_type: string | null;
	entity_id: string | null;
};

/** Signed-in user + their roles (own rows readable via RLS). Redirects to /login when signed out. */
export async function session(event: Pick<RequestEvent, 'locals' | 'url'>) {
	const user = await event.locals.getUser();
	if (!user) {
		if (event.url.pathname.startsWith('/api/')) error(401, 'sign in');
		redirect(303, '/login');
	}
	const { data } = await event.locals.supabase
		.from('user_roles')
		.select('role, taluka_id, entity_type, entity_id')
		.eq('user_id', user.id);
	const roles = (data ?? []) as Role[];
	const has = (r: string) => roles.some((x) => x.role === r);
	return {
		user,
		roles,
		isAdmin: has('admin'),
		isReviewer: has('reviewer') || has('admin'),
		isVerifier: has('verifier') || has('reviewer') || has('admin')
	};
}

export async function requireStaff(
	event: Pick<RequestEvent, 'locals' | 'url'>,
	level: 'verifier' | 'reviewer' | 'admin' = 'verifier'
) {
	const s = await session(event);
	const ok = level === 'admin' ? s.isAdmin : level === 'reviewer' ? s.isReviewer : s.isVerifier;
	if (!ok) error(403, 'not allowed');
	return s;
}
