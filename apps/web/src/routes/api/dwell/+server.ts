import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { session } from '#lib/server/auth.ts';
import type { RequestHandler } from './$types';

const body = z
	.object({
		place: z.string().min(1).max(200),
		anon_id: z.uuid(),
		arrived_at: z.iso.datetime(),
		left_at: z.iso.datetime()
	})
	.refine((b) => b.left_at > b.arrived_at);

// POST /api/dwell — one anonymous visit (BACKEND §10.6). RLS accepts it only with an active dwell_time
// consent; the row stores a random per-day id, never the user id or a GPS track.
export const POST: RequestHandler = async (event) => {
	await session(event);
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
	const { error: err } = await db.from('dwell_events').insert({
		anon_id: b.data.anon_id,
		place_id: p.id,
		arrived_at: b.data.arrived_at,
		left_at: b.data.left_at
	});
	if (err) error(403, 'no consent');
	return json({ ok: true }, { status: 201 });
};
