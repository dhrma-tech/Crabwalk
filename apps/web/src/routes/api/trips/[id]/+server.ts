import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { session } from '#lib/server/auth.ts';
import { editInput, editTrip } from '#lib/server/planner/trips.ts';
import type { RequestHandler } from './$types';

// PATCH /api/trips/:id — title/status/date, reorder/add/remove stops, budget inputs (owner via RLS).
export const PATCH: RequestHandler = async (event) => {
	await session(event);
	const b = editInput.safeParse(await event.request.json().catch(() => null));
	if (!z.uuid().safeParse(event.params.id).success || !b.success) error(400, 'bad request');
	const ok = await editTrip(event.locals.supabase, event.params.id, b.data);
	if (!ok) error(404, 'not found');
	return json({ ok: true });
};
