import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { getLocale } from '#lib/paraglide/runtime.js';
import { session } from '#lib/server/auth.ts';
import { nearby, type Lang } from '#lib/server/listings.ts';
import { describeStops, tripView } from '#lib/server/planner/trips.ts';
import type { Actions, PageServerLoad } from './$types';

// Plan view (FRONTEND §7.9): owner edits; group votes shown per stop; share/vote links; publish route.
export const load: PageServerLoad = async (event) => {
	const s = await session(event);
	if (!z.uuid().safeParse(event.params.id).success) error(404, 'not found');
	const db = event.locals.supabase;
	const lang = getLocale() as Lang;
	const { data: t } = await db
		.from('trips')
		.select('*, trip_stops(*), trip_budget(*), published_routes(status)')
		.eq('id', event.params.id)
		.maybeSingle();
	if (!t || (t.owner_id !== s.user.id && !s.isAdmin)) error(404, 'not found');
	const budget = Array.isArray(t.trip_budget) ? (t.trip_budget[0] ?? null) : t.trip_budget;
	const view = await tripView(db, t, t.trip_stops, budget, lang);

	// "Add a stay / meal" options: published stays + eateries within ~5 km of each day's last stop.
	const info = await describeStops(db, t.trip_stops, lang);
	const add = await Promise.all(
		view.days.map(async (d) => {
			const last = d.stops.filter((x) => x.kind !== 'stay').at(-1);
			const pt = last ? info.get(last.entity_id)?.pt : null;
			if (!pt) return [];
			const { listings } = await nearby(db, pt.lon, pt.lat);
			return listings.map((n) => ({
				kind: n.kind === 'stay' ? ('stay' as const) : ('meal' as const),
				entity_id: n.id,
				name: (lang === 'hi' ? n.name_hi : lang === 'mr' ? n.name_mr : null) || n.name_en || n.slug
			}));
		})
	);

	const { data: votes } = await db
		.from('group_votes')
		.select('entity_id, vote, voter_token')
		.eq('trip_id', t.id);
	const tally: Record<string, { up: number; down: number }> = {};
	for (const v of votes ?? []) {
		const x = (tally[v.entity_id] ??= { up: 0, down: 0 });
		x[v.vote as 'up' | 'down']++;
	}
	const route = Array.isArray(t.published_routes) ? t.published_routes[0] : t.published_routes;
	return {
		...view,
		add,
		votes: tally,
		voters: new Set((votes ?? []).map((v) => v.voter_token)).size,
		shareToken: t.share_token,
		published: (route as { status: string } | null)?.status ?? null,
		isAdmin: s.isAdmin
	};
};

export const actions: Actions = {
	rename: async (event) => {
		await session(event);
		const title = String((await event.request.formData()).get('title') ?? '').trim();
		if (!title || title.length > 120) return fail(400);
		const { error: e } = await event.locals.supabase
			.from('trips')
			.update({ title, status: 'saved' })
			.eq('id', event.params.id);
		if (e) return fail(403);
	},
	publish: async (event) => {
		await session(event);
		const db = event.locals.supabase;
		const { data: existing } = await db
			.from('published_routes')
			.select('status')
			.eq('trip_id', event.params.id)
			.maybeSingle();
		const { error: e } = existing
			? await db
					.from('published_routes')
					.update({ status: 'pending_review' })
					.eq('trip_id', event.params.id)
			: await db.from('published_routes').insert({ trip_id: event.params.id });
		if (e) return fail(403);
		return { published: true };
	},
	readyMade: async (event) => {
		const s = await session(event);
		if (!s.isAdmin) return fail(403);
		const slug = String((await event.request.formData()).get('slug') ?? '').trim();
		if (!/^[a-z0-9-]{3,60}$/.test(slug)) return fail(400, { error: 'slug' });
		const { error: e } = await event.locals.supabase
			.from('trips')
			.update({ is_ready_made: true, slug })
			.eq('id', event.params.id);
		if (e) return fail(400, { error: 'slug' });
		return { readyMade: true };
	},
	delete: async (event) => {
		await session(event);
		const { error: e } = await event.locals.supabase
			.from('trips')
			.delete()
			.eq('id', event.params.id);
		if (e) return fail(403);
		redirect(303, '/me');
	}
};
