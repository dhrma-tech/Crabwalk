import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { session } from '#lib/server/auth.ts';
import { hostFill } from '#lib/server/ai/host.ts';
import type { RequestHandler } from './$types';

const body = z.object({
	type: z.enum(['stay', 'eatery']),
	text: z.string().trim().min(3).max(1500)
});

// POST /api/ai/host — Host Crabby (P12 step J, 10.4): the owner's words → fields to review on their form.
// Owners and staff only (their own listing forms); its own daily cap (ai_cap_host).
export const POST: RequestHandler = async (event) => {
	const s = await session(event);
	if (!s.roles.some((r) => r.role === 'owner') && !s.isVerifier) error(403, 'not allowed');
	const b = body.safeParse(await event.request.json().catch(() => null));
	if (!b.success) error(400, 'bad request');
	const { error: cap } = await event.locals.supabase.rpc('ai_take', { _feature: 'host' });
	if (cap) return json({ kind: 'limit' }, { status: 429 });
	return json({ kind: 'fill', fill: await hostFill(b.data.type, b.data.text) });
};
