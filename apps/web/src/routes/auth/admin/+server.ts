// TODO(before-deploy): restore full auth — temporary admin gate (lib/server/gate.ts, docs/RESTORE_AUTH.md).
// POST {email, passcode}: allow-listed email AND the team passcode → admin session + signed cookie; otherwise the
// visitor stays a guest. The allowlist and passcode are checked here only and never sent to the browser.
// 10 failed tries from one client lock it out for an hour (gate_attempts); 50 failed tries from all clients
// together lock everyone out for 15 minutes (SEC-08); the per-client rate limit (lib/server/rate.ts) also
// applies. Every attempt is one security event with a SHA-256 of the email (never the email or the passcode).
// DELETE: exit admin (cookie cleared, admin session ended).
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
import { securityEvent } from '#lib/server/log.ts';
import type { RequestHandler } from './$types';

const body = z.object({
	email: z.string().trim().max(254).pipe(z.email()),
	passcode: z.string().max(200)
});
const locked = (until: string) =>
	json(
		{ admin: false, locked: true, until },
		{
			status: 429,
			headers: {
				'Retry-After': String(Math.max(60, Math.ceil((Date.parse(until) - Date.now()) / 1000)))
			}
		}
	);
// One counter for every client together (fixed key, same shape as the per-client HMAC keys).
const GLOBAL = '0'.repeat(64);
const sha256 = async (t: string) =>
	[...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))]
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
// One security event per attempt (SEC-16): the email only as a SHA-256, never the passcode.
const record = async (
	kind: string,
	email: string,
	event: Parameters<RequestHandler>[0],
	key: string,
	extra: Record<string, unknown> = {}
) => securityEvent(kind, { email_sha256: await sha256(email), ...extra }, event, key);

export const POST: RequestHandler = async (event) => {
	if (!tempGate()) error(404);
	const b = body.safeParse(await event.request.json().catch(() => null));
	if (!b.success) error(400, 'enter an email address and the passcode');
	const db = serviceClient();
	const key = await clientKey(event, 'admin-gate-lock');
	const email = normEmail(b.data.email);
	const [{ data: all }, { data: until }] = await Promise.all([
		db.rpc('gate_locked', { _key: GLOBAL }),
		db.rpc('gate_locked', { _key: key })
	]);
	if (all || until) {
		await record('admin_gate_locked', email, event, key);
		return locked((all ?? until)!);
	}

	if (!(await adminCredentials(email, b.data.passcode))) {
		const [{ data: lock }, { data: globalLock }] = await Promise.all([
			db.rpc('gate_record', { _key: key, _ok: false }),
			db.rpc('gate_record', { _key: GLOBAL, _ok: false, _max: 50, _lock_s: 900 })
		]);
		await record(lock ? 'admin_gate_fail_locked' : 'admin_gate_fail', email, event, key);
		if (globalLock)
			await record('admin_gate_global_lock', email, event, key, { until: globalLock });
		return lock || globalLock ? locked((lock ?? globalLock)!) : json({ admin: false });
	}
	// Only this client's counter is cleared: a real admin signing in never resets the global count.
	await db.rpc('gate_record', { _key: key, _ok: true });
	try {
		await startAdminSession(event, email);
	} catch (e) {
		console.error('admin session', e);
		error(502, 'could not start the admin session');
	}
	await setAdminCookie(event.cookies, email, event.url);
	await record('admin_gate_ok', email, event, key);
	return json({ admin: true, to: '/admin/content' });
};

export const DELETE: RequestHandler = async ({ cookies, locals, url }) => {
	if (!tempGate()) error(404);
	clearAdminCookie(cookies, url);
	await locals.supabase.auth.signOut({ scope: 'local' });
	return json({ ok: true });
};
