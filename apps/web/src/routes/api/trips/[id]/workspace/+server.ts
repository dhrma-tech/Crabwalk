import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { session } from '#lib/server/auth.ts';
import { applyOp, workspaceOp } from '#lib/server/planner/workspace.ts';
import type { RequestHandler } from './$types';

// POST /api/trips/:id/workspace — one list / item / notes edit on the plan workspace (P11 §3). Owner and
// editors only (RLS).
export const POST: RequestHandler = async (event) => {
	await session(event);
	const b = workspaceOp.safeParse(await event.request.json().catch(() => null));
	if (!z.uuid().safeParse(event.params.id).success || !b.success) error(400, 'bad request');
	if (!(await applyOp(event.locals.supabase, event.params.id, b.data))) error(409, 'not applied');
	return json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
};
