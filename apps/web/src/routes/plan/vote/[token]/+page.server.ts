import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { getLocale } from '#lib/paraglide/runtime.js';
import type { Lang } from '#lib/server/listings.ts';
import { describeStops, VOTER_COOKIE } from '#lib/server/planner/trips.ts';
import type { Actions, PageServerLoad } from './$types';

// Group vote (FRONTEND §7.10): no login; spot cards + up/down + name. Plain form, works without JS.
export const load: PageServerLoad = async ({ params, locals }) => {
	if (!/^[0-9a-f]{32}$/.test(params.token)) error(404, 'not found');
	const db = locals.supabase;
	const [{ data }, { data: counts }] = await Promise.all([
		db.rpc('get_shared_trip', { _token: params.token }),
		db.rpc('trip_vote_counts', { _token: params.token })
	]);
	if (!data) error(404, 'not found');
	const d = data as {
		trip: { title: string };
		stops: { kind: string; entity_type: 'place' | 'stay' | 'eatery'; entity_id: string }[];
	};
	const spots = [
		...new Map(d.stops.filter((s) => s.kind === 'place').map((s) => [s.entity_id, s])).values()
	];
	const info = await describeStops(db, spots, getLocale() as Lang);
	const tally = new Map((counts ?? []).map((c) => [c.entity_id, c]));
	return {
		title: d.trip.title,
		spots: spots.map((s) => ({
			id: s.entity_id,
			name: info.get(s.entity_id)?.name ?? null,
			href: info.get(s.entity_id)?.href ?? null,
			up: tally.get(s.entity_id)?.up ?? 0,
			down: tally.get(s.entity_id)?.down ?? 0
		}))
	};
};

export const actions: Actions = {
	default: async ({ params, request, cookies, locals }) => {
		const f = await request.formData();
		const name = z.string().trim().min(1).max(60).safeParse(f.get('name'));
		if (!name.success) return fail(400, { error: 'name' });
		const votes = [...f.entries()]
			.filter(([k, v]) => k.startsWith('v:') && (v === 'up' || v === 'down'))
			.map(([k, v]) => ({ id: k.slice(2), vote: v as string }))
			.filter((x) => z.uuid().safeParse(x.id).success);
		if (!votes.length) return fail(400, { error: 'votes' });
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
		for (const v of votes) {
			const { error: e } = await locals.supabase.rpc('cast_group_vote', {
				_token: params.token,
				_voter_token: voter,
				_voter_name: name.data,
				_entity_id: v.id,
				_vote: v.vote
			});
			if (e) return fail(400, { error: 'votes' });
		}
		return { sent: true };
	}
};
