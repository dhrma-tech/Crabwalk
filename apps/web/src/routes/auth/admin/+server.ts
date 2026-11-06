// TODO(before-deploy): restore full auth — temporary admin gate (lib/server/gate.ts, docs/RESTORE_AUTH.md).
// POST {email, passcode}: allow-listed email AND the team passcode → admin session + signed cookie; otherwise the
// visitor stays a guest. The allowlist and passcode are checked here only and never sent to the browser.
// 10 failed tries from one client lock it out for an hour (gate_attempts); the per-client rate limit
// (lib/server/rate.ts) also applies. DELETE: exit admin (cookie cleared, admin session ended).
import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { startAdminSession } from '#lib/server/adminSession.ts';
import {
	adminCredentials,
	clearAdminCookie,
	normEmail,
	setAdminCookie,
	tempGate
} from '#lib/server/gate.ts';
import { clientKey } from '#lib/server/rate.ts';
import { serviceClient } from '#lib/server/service.ts';
import type { RequestHandler } from './$types';

const body = z.object({
	email: z.string().trim().max(254).pipe(z.email()),
	passcode: z.string().max(200)
});
const locked = (until: string) =>
	json({ admin: false, locked: true, until }, { status: 429, headers: { 'Retry-After': '3600' } });

export const POST: RequestHandler = async (event) => {
	if (!tempGate()) error(404);
	const b = body.safeParse(await event.request.json().catch(() => null));
	if (!b.success) error(400, 'enter an email address and the passcode');
	const db = serviceClient();
	const key = await clientKey(event, 'admin-gate-lock');
	const { data: until } = await db.rpc('gate_locked', { _key: key });
	if (until) return locked(until);

	const email = normEmail(b.data.email);
	if (!(await adminCredentials(email, b.data.passcode))) {
		const { data: lock } = await db.rpc('gate_record', { _key: key, _ok: false });
		return lock ? locked(lock) : json({ admin: false });
	}
	await db.rpc('gate_record', { _key: key, _ok: true });
	try {
		await startAdminSession(event, email);
	} catch (e) {
		console.error('admin session', e);
		error(502, 'could not start the admin session');
	}
	await setAdminCookie(event.cookies, email, event.url.protocol === 'https:');
	return json({ admin: true, to: '/admin/content' });
};

export const DELETE: RequestHandler = async ({ cookies, locals }) => {
	if (!tempGate()) error(404);
	clearAdminCookie(cookies);
	await locals.supabase.auth.signOut({ scope: 'local' });
	return json({ ok: true });
};
