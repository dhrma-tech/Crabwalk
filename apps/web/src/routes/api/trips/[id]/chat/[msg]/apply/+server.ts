import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { session } from '#lib/server/auth.ts';
import { editInput, editTrip } from '#lib/server/planner/trips.ts';
import { addToDay } from '#lib/server/planner/workspace.ts';
import { postMessage } from '#lib/server/chat/trip-chat.ts';
import type { RequestHandler } from './$types';

// POST /api/trips/:id/chat/:msg/apply — an editor applies a plan change Crabby proposed in the group chat. The
// card's payload was signed by our server when Crabby posted it; the change runs our own code (never the LLM),
// with the applier's permissions (RLS: owner or editor), once.
export const POST: RequestHandler = async (event) => {
	await session(event);
	const ids = z.object({ id: z.uuid(), msg: z.uuid() }).safeParse(event.params);
	if (!ids.success) error(400, 'bad request');
	const db = event.locals.supabase;
	const trip = ids.data.id.toLowerCase();
	const { data: card } = await db
		.from('trip_messages')
		.select('id, body, payload')
		.eq('id', ids.data.msg)
		.eq('trip_id', trip)
		.eq('kind', 'card')
		.eq('from_crabby', true)
		.maybeSingle();
	const p = card?.payload as { action?: string; data?: Record<string, unknown> } | null;
	if (!card || !p?.action || !p.data) error(404, 'not found');
	const { count } = await db
		.from('trip_messages')
		.select('id', { count: 'exact', head: true })
		.eq('trip_id', trip)
		.eq('kind', 'system')
		.contains('payload', { applied: card.id });
	if (count) error(409, 'already applied');
	const d = p.data;
	let ok = false;
	if (p.action === 'edit_plan' && String(d.trip_id) === trip) {
		const e = editInput.safeParse({ days: d.days });
		ok = e.success && !!(await editTrip(db, trip, e.data).catch(() => null));
	} else if (p.action === 'add_to_trip' && String(d.trip_id) === trip)
		ok = await addToDay(
			db,
			trip,
			d.type as 'place' | 'stay' | 'eatery',
			String(d.entity_id),
			Number(d.day)
		).catch(() => false);
	if (!ok) error(403, 'not applied');
	await postMessage(db, trip, { kind: 'system', body: card.body, payload: { applied: card.id } });
	return json({ ok: true });
};
