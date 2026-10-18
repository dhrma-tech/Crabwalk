import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { VOTER_COOKIE } from '#lib/server/planner/trips.ts';
import type { RequestHandler } from './$types';

const body = z.object({
	entity_id: z.uuid(),
	vote: z.enum(['up', 'down']),
	name: z.string().trim().min(1).max(60)
});

// POST /api/trips/:token/vote — guest vote, no login (BACKEND §10.4). :id here is the share token.
export const POST: RequestHandler = async ({ params, request, cookies, locals }) => {
	const b = body.safeParse(await request.json().catch(() => null));
	if (!b.success || !/^[0-9a-f]{32}$/.test(params.id)) error(400, 'bad request');
	let voter = cookies.get(VOTER_COOKIE);
	if (!voter) {
		voter = crypto.randomUUID();
		cookies.set(VOTER_COOKIE, voter, {
			path: '/',
			maxAge: 60 * 60 * 24 * 90,
			httpOnly: true,
			sameSite: 'lax'
		});
	}
	const { error: err } = await locals.supabase.rpc('cast_group_vote', {
		_token: params.id,
		_voter_token: voter,
		_voter_name: b.data.name,
		_entity_id: b.data.entity_id,
		_vote: b.data.vote
	});
	if (err) error(err.code === '42501' ? 404 : 400, 'vote not saved');
	return json({ ok: true });
};
