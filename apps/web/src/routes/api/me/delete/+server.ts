import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { session } from '#lib/server/auth.ts';
import { SIGNED_IN_COOKIE } from '#lib/login.ts';
import { removeUserFiles } from '#lib/server/account.ts';
import { securityEvent } from '#lib/server/log.ts';
import { serviceClient } from '#lib/server/service.ts';
import type { RequestHandler } from './$types';

const body = z.object({ confirm: z.literal('delete') });

// POST /api/me/delete {confirm: "delete"} (SEC-15): the user's files in the traveller buckets, then the auth user;
// their rows go with it (foreign keys cascade; trips they own go for every tripmate). Staff cannot delete
// themselves here. A listing owner whose listings still point at them gets 409 (the team removes them).
// The page purges the service worker's caches before calling. Rate rule `me-delete`.
export const POST: RequestHandler = async (event) => {
	const s = await session(event);
	if (!body.safeParse(await event.request.json().catch(() => null)).success)
		error(400, 'confirm with "delete"');
	if (s.isVerifier || s.user.app_metadata?.temp_admin)
		error(403, 'staff accounts are removed by an admin');
	// Listings point at their owner without a cascade: refuse before any file is touched.
	if (s.roles.some((r) => r.role === 'owner')) error(409, 'this account still owns listings');
	const svc = serviceClient();
	let files = 0;
	try {
		files = await removeUserFiles(svc, s.user.id);
	} catch {
		error(502, 'files not removed; nothing was deleted');
	}
	const { error: err } = await svc.auth.admin.deleteUser(s.user.id);
	if (err) {
		await securityEvent('account_delete_blocked', { reason: err.code ?? 'unknown' }, event);
		error(409, 'this account still owns listings or team records');
	}
	await securityEvent('account_deleted', { files }, event);
	await event.locals.supabase.auth.signOut({ scope: 'local' }).catch(() => null);
	for (const c of event.cookies.getAll())
		if (c.name.startsWith('sb-') || c.name === SIGNED_IN_COOKIE)
			event.cookies.delete(c.name, { path: '/' });
	return json({ ok: true });
};
