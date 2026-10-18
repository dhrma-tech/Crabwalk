import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { session } from '#lib/server/auth.ts';
import type { RequestHandler } from './$types';

const sub = z.object({
	endpoint: z.url().max(1000),
	keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) })
});

// POST /api/push/subscribe — records consent (push) then the subscription (RLS requires the consent).
export const POST: RequestHandler = async (event) => {
	const { user } = await session(event);
	const b = sub.safeParse(await event.request.json().catch(() => null));
	if (!b.success) error(400, 'bad request');
	const db = event.locals.supabase;
	const now = new Date().toISOString();
	const c = await db
		.from('consents')
		.upsert(
			{ user_id: user.id, type: 'push', granted: true, granted_at: now, revoked_at: null },
			{ onConflict: 'user_id,type' }
		);
	if (c.error) error(403, 'consent not saved');
	const { error: err } = await db.from('push_subscriptions').upsert(
		{
			user_id: user.id,
			endpoint: b.data.endpoint,
			p256dh: b.data.keys.p256dh,
			auth: b.data.keys.auth
		},
		{ onConflict: 'endpoint' }
	);
	if (err) error(403, 'not saved');
	return json({ ok: true }, { status: 201 });
};

// DELETE — revoke consent; a trigger removes every subscription of this user.
export const DELETE: RequestHandler = async (event) => {
	const { user } = await session(event);
	const { error: err } = await event.locals.supabase
		.from('consents')
		.upsert(
			{ user_id: user.id, type: 'push', granted: false, revoked_at: new Date().toISOString() },
			{ onConflict: 'user_id,type' }
		);
	if (err) error(403, 'not saved');
	return json({ ok: true });
};
