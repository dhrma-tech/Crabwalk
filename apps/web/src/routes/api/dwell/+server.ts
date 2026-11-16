import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { session } from '#lib/server/auth.ts';
import { hmac } from '#lib/server/rate.ts';
import { serviceClient } from '#lib/server/service.ts';
import type { RequestHandler } from './$types';

const body = z
	.object({
		place: z.string().min(1).max(200),
		anon_id: z.string().max(100).optional(), // ignored: the id is derived on the server (SEC-04)
		arrived_at: z.iso.datetime(),
		left_at: z.iso.datetime()
	})
	.refine((b) => b.left_at > b.arrived_at);

// POST /api/dwell — one anonymous visit (BACKEND §10.6). record_dwell (service role) accepts it only with an
// active dwell_time consent; the row stores a per-day id derived from a server secret, never the user id or a
// GPS track. One row per id, place and day.
export const POST: RequestHandler = async (event) => {
	const { user } = await session(event);
	const b = body.safeParse(await event.request.json().catch(() => null));
	if (!b.success) error(400, 'bad request');
	const db = event.locals.supabase;
	const { data: p } = await db
		.from('places')
		.select('id')
		.eq('slug', b.data.place)
		.eq('status', 'published')
		.maybeSingle();
	if (!p) error(404, 'not found');
	const istDate = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
	const h = await hmac(`${user.id}:${istDate}`);
	const { error: err } = await serviceClient().rpc('record_dwell', {
		_user: user.id,
		_place: p.id,
		// UUID-shaped (the column check is ^[0-9a-f-]{36}$), not a real UUID.
		_anon_id: `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`,
		_arrived: b.data.arrived_at,
		_left: b.data.left_at
	});
	if (err)
		error(err.code === '42501' ? 403 : 400, err.code === '42501' ? 'no consent' : 'bad request');
	return json({ ok: true }, { status: 201 });
};
