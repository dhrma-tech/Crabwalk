import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { session } from '#lib/server/auth.ts';
import { decide } from '#lib/server/ai/actions.ts';
import type { RequestHandler } from './$types';

// POST /api/ai/actions/:id/apply — the user's decision on a Crabby preview.
export const POST: RequestHandler = async (event) => {
	const { user } = await session(event);
	if (!z.uuid().safeParse(event.params.id).success) error(400, 'bad request');
	const r = await decide(event.locals.supabase, user.id, event.params.id, true);
	if (r.status !== 200) error(r.status, 'not found');
	return json({ href: r.href });
};
