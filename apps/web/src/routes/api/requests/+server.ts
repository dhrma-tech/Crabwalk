import { error, json } from '@sveltejs/kit';
import { session } from '#lib/server/auth.ts';
import { createRequest, requestInput } from '#lib/server/requests.ts';
import type { RequestHandler } from './$types';

// POST /api/requests — an availability request for a homestay or eatery that isn't on any OTA (P12 step I,
// 10.2). No booking and no payment happen here; the owner (or our team) replies on Crabwalk.
export const POST: RequestHandler = async (event) => {
	await session(event);
	const b = requestInput.safeParse(await event.request.json().catch(() => null));
	if (!b.success) error(400, 'bad request');
	if (!(await createRequest(event.locals.supabase, b.data))) error(409, 'not sent');
	return json({ ok: true }, { status: 201 });
};
