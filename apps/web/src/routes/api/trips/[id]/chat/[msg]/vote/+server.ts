import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { session } from '#lib/server/auth.ts';
import type { RequestHandler } from './$types';

const body = z.object({ options: z.array(z.number().int().min(0).max(3)).min(1).max(4) });

// POST /api/trips/:id/chat/:msg/vote — a tripmate's pick on a poll card (replaces the old no-login vote link).
export const POST: RequestHandler = async (event) => {
	const { user } = await session(event);
	const ids = z.object({ id: z.uuid(), msg: z.uuid() }).safeParse(event.params);
	const b = body.safeParse(await event.request.json().catch(() => null));
	if (!ids.success || !b.success) error(400, 'bad request');
	const db = event.locals.supabase;
	const trip = ids.data.id.toLowerCase();
	const [{ data: poll }, { data: me }] = await Promise.all([
		db
			.from('trip_messages')
			.select('payload')
			.eq('id', ids.data.msg)
			.eq('trip_id', trip)
			.eq('kind', 'poll')
			.maybeSingle(),
		db.from('trip_members').select('id').eq('trip_id', trip).eq('user_id', user.id).maybeSingle()
	]);
	const p = poll?.payload as { options?: string[]; multi?: boolean } | null;
	if (!p || !me) error(404, 'not found');
	const picks = [...new Set(b.data.options)].filter((i) => i < (p.options?.length ?? 0));
	if (!picks.length || (!p.multi && picks.length > 1)) error(400, 'bad request');
	const { error: e } = await db
		.from('trip_poll_votes')
		.upsert(
			{ message_id: ids.data.msg, trip_id: trip, member_id: me.id, options: picks },
			{ onConflict: 'message_id,member_id' }
		);
	if (e) error(403, 'not allowed');
	return json({ ok: true });
};
