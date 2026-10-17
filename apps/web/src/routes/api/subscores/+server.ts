import { error, json } from '@sveltejs/kit';
import { session } from '#lib/server/auth.ts';
import { assertPublished, subScoreInput } from '#lib/server/ratings.ts';
import type { RequestHandler } from './$types';

// POST /api/subscores — quick taps 0–5. Hygiene/cleanliness only with a verified visit: enforced by RLS
// (403 here), dimension/type pairing by a DB trigger (400).
export const POST: RequestHandler = async (event) => {
	const { user } = await session(event);
	const b = subScoreInput.safeParse(await event.request.json().catch(() => null));
	if (!b.success || !Object.keys(b.data.scores).length) error(400, 'bad request');
	const db = event.locals.supabase;
	if (!(await assertPublished(db, b.data.entity_type, b.data.entity_id))) error(404, 'not found');
	const rows = Object.entries(b.data.scores).map(([dimension, score]) => ({
		user_id: user.id,
		entity_type: b.data.entity_type,
		entity_id: b.data.entity_id,
		dimension: dimension as keyof typeof b.data.scores,
		score,
		updated_at: new Date().toISOString()
	}));
	const { error: err } = await db
		.from('sub_scores')
		.upsert(rows, { onConflict: 'user_id,entity_type,entity_id,dimension' });
	if (err)
		error(
			err.code === '42501' ? 403 : 400,
			err.code === '42501' ? 'verified visitors only' : 'not saved'
		);
	return json({ ok: true });
};
