import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { getLocale } from '#lib/paraglide/runtime.js';
import { session } from '#lib/server/auth.ts';
import { crabbyTurn } from '#lib/server/ai/chat.ts';
import type { Lang } from '#lib/server/listings.ts';
import type { RequestHandler } from './$types';

const body = z.object({
	message: z.string().trim().min(1).max(1000),
	history: z
		.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) }))
		.max(20)
		.default([])
});

// POST /api/ai/chat — login required (BACKEND §11.5); nothing about the conversation is stored.
export const POST: RequestHandler = async (event) => {
	const { user } = await session(event);
	const b = body.safeParse(await event.request.json().catch(() => null));
	if (!b.success) error(400, 'bad request');
	const r = await crabbyTurn(
		event.locals.supabase,
		user.id,
		getLocale() as Lang,
		b.data.message,
		b.data.history
	);
	return json(r, { status: r.kind === 'limit' ? 429 : 200 });
};
