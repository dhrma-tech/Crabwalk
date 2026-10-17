import { error, json } from '@sveltejs/kit';
import { session } from '#lib/server/auth.ts';
import { claim, claimInput } from '#lib/server/owner.ts';
import type { RequestHandler } from './$types';

// POST /api/owner/claim {type, id} — signed-in (email OTP / Google) user claims a stay/eatery (G5).
export const POST: RequestHandler = async (event) => {
	const { user } = await session(event);
	const b = claimInput.safeParse(await event.request.json().catch(() => null));
	if (!b.success) error(400, 'bad request');
	try {
		return json(await claim(event.locals.supabase, user, b.data), { status: 201 });
	} catch {
		error(400, 'claim not saved');
	}
};
