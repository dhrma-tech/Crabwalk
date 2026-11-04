import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { session } from '#lib/server/auth.ts';
import { applyOp, workspaceOp } from '#lib/server/planner/workspace.ts';
import type { RequestHandler } from './$types';

// POST /api/trips/:id/workspace — one list / item / notes / spend / tripmate / invite edit on the plan workspace
// (P11 §3–§6). Owner and editors only; invites owner only (RLS). Answers new row ids for undo.
export const POST: RequestHandler = async (event) => {
	await session(event);
	const b = workspaceOp.safeParse(await event.request.json().catch(() => null));
	if (!z.uuid().safeParse(event.params.id).success || !b.success) error(400, 'bad request');
	const r = await applyOp(event.locals.supabase, event.params.id, b.data);
	if (!r) error(409, 'not applied');
	return json({ ok: true, ...r }, { headers: { 'Cache-Control': 'private, no-store' } });
};
