import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { requireStaff } from '#lib/server/auth.ts';
import { publish } from '#lib/server/review.ts';
import type { RequestHandler } from './$types';

const body = z.object({ type: z.enum(['place', 'stay', 'eatery', 'dish']) });

// POST /api/admin/drafts/:id/approve {type} — :id is the listing id; approves its pending drafts and publishes.
export const POST: RequestHandler = async (event) => {
	await requireStaff(event, 'reviewer');
	const b = body.safeParse(await event.request.json().catch(() => null));
	if (!b.success || !z.uuid().safeParse(event.params.id).success) error(400, 'bad request');
	try {
		await publish(event.locals.supabase, b.data.type, event.params.id);
	} catch (e) {
		error((e as { code?: string }).code === '42501' ? 403 : 400, 'not approved');
	}
	return json({ ok: true });
};
