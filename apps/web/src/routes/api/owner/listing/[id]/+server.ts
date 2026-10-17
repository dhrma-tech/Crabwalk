import { error, json } from '@sveltejs/kit';
import { session } from '#lib/server/auth.ts';
import { parseFacts, updateFacts } from '#lib/server/owner.ts';
import type { RequestHandler } from './$types';

// PATCH /api/owner/listing/:id — fact fields only (BACKEND §4). Triggers reject anything else.
export const PATCH: RequestHandler = async (event) => {
	await session(event);
	const b = parseFacts(await event.request.json().catch(() => null));
	if (!b.success) error(400, b.error.issues.map((i) => i.path.join('.')).join(', '));
	try {
		await updateFacts(event.locals.supabase, event.params.id, b.data);
	} catch (e) {
		error((e as { code?: string }).code === '42501' ? 403 : 400, 'not saved');
	}
	return json({ ok: true });
};
