import { error, json } from '@sveltejs/kit';
import { session } from '#lib/server/auth.ts';
import { assertPublished, verdictInput } from '#lib/server/ratings.ts';
import type { RequestHandler } from './$types';

// POST /api/verdicts — one verdict per user per item per group type; editable (BACKEND §5). Owners blocked by RLS.
export const POST: RequestHandler = async (event) => {
	const { user } = await session(event);
	const b = verdictInput.safeParse(await event.request.json().catch(() => null));
	if (!b.success) error(400, 'bad request');
	const db = event.locals.supabase;
	if (!(await assertPublished(db, b.data.entity_type, b.data.entity_id))) error(404, 'not found');
	const { remember, ...vote } = b.data;
	const { error: err } = await db
		.from('verdicts')
		.upsert(
			{ ...vote, user_id: user.id, updated_at: new Date().toISOString() },
			{ onConflict: 'user_id,entity_type,entity_id,group_type' }
		);
	if (err) error(err.code === '42501' ? 403 : 400, 'vote not saved');
	// Remember the traveller group (T1-05): never overwrites one already chosen.
	if (remember) {
		const group_type = vote.group_type;
		await db
			.from('user_preferences')
			.upsert({ user_id: user.id, group_type }, { onConflict: 'user_id', ignoreDuplicates: true });
		await db
			.from('user_preferences')
			.update({ group_type, updated_at: new Date().toISOString() })
			.eq('user_id', user.id)
			.is('group_type', null);
	}
	return json({ ok: true });
};
