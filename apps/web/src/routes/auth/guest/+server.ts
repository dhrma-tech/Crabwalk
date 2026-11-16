import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { tempGate } from '#lib/server/gate.ts';
import type { RequestHandler } from './$types';

const body = z.object({
	access_token: z.string().min(20).max(4096),
	refresh_token: z.string().min(1).max(512)
});

// POST /auth/guest {access_token, refresh_token} (SEC-02). The browser created an anonymous user directly with
// Supabase Auth (lib/guest.session.ts: Turnstile and per-IP limits apply to the visitor); this stores that
// session in the usual auth cookies. Only anonymous sessions are accepted, and only a JSON body, so another site
// cannot post one without a CORS preflight we never answer.
// TODO(before-deploy): restore full auth — only while the temp gate is on.
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!tempGate()) error(404, 'not found');
	if (!request.headers.get('content-type')?.startsWith('application/json')) error(415, 'json only');
	const b = body.safeParse(await request.json().catch(() => null));
	if (!b.success) error(400, 'bad request');
	// Checked with Supabase Auth before anything is stored.
	const { data: u, error: bad } = await locals.supabase.auth.getUser(b.data.access_token);
	if (bad || !u.user?.is_anonymous) error(400, 'not a guest session');
	const { error: err } = await locals.supabase.auth.setSession(b.data);
	if (err) error(400, 'session not stored');
	return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
};
