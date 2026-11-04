import { json } from '@sveltejs/kit';
import { session } from '#lib/server/auth.ts';
import type { RequestHandler } from './$types';

// GET /api/me/questions — the user's own questions to our team (P12 step E, 10.1): open ones are "Pending",
// answered ones show the team's answer once as new, then stay for 30 days. POST marks new answers as seen.
export const GET: RequestHandler = async (event) => {
	const { user } = await session(event);
	const since = new Date(Date.now() - 30 * 864e5).toISOString();
	const { data } = await event.locals.supabase
		.from('team_questions')
		.select('id, question, status, answer, answered_at, seen_at')
		.eq('asker', user.id)
		.or(`status.eq.open,answered_at.gte.${since}`)
		.order('created_at', { ascending: false })
		.limit(10);
	return json(
		(data ?? []).map((q) => ({
			id: q.id,
			question: q.question,
			status: q.status,
			answer: q.answer,
			answered_on: q.answered_at?.slice(0, 10) ?? null,
			fresh: q.status === 'answered' && !q.seen_at
		})),
		{ headers: { 'Cache-Control': 'private, no-store' } }
	);
};

export const POST: RequestHandler = async (event) => {
	await session(event);
	await event.locals.supabase.rpc('mark_team_answers_seen');
	return new Response(null, { status: 204 });
};
