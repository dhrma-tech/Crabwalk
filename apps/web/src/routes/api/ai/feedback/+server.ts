import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { session } from '#lib/server/auth.ts';
import { turnThumbs } from '#lib/server/aiStore.ts';
import type { RequestHandler } from './$types';

// POST /api/ai/feedback (hardening T2-05, AI-10): thumbs on a Crabby turn (stored on its no-text log row), or —
// after a thumbs down, only when the user says yes — the last question and answer sent to our team (ai_leads).
const body = z.union([
	z.object({ turn: z.number().int().positive(), thumbs: z.union([z.literal(-1), z.literal(1)]) }),
	z.object({
		send: z.literal(true),
		question: z.string().trim().min(1).max(450),
		answer: z.string().trim().max(450)
	})
]);

export const POST: RequestHandler = async (event) => {
	await session(event);
	const b = body.safeParse(await event.request.json().catch(() => null));
	if (!b.success) error(400, 'bad request');
	if ('turn' in b.data) {
		if (!(await turnThumbs(b.data.turn, b.data.thumbs))) error(404, 'not found');
		return new Response(null, { status: 204 });
	}
	const { error: err } = await event.locals.supabase.from('ai_leads').insert({
		kind: 'question',
		input: `Thumbs down.\nQ: ${b.data.question}\nA: ${b.data.answer}`.slice(0, 1000)
	});
	if (err) error(400, 'not sent');
	return new Response(null, { status: 204 });
};
