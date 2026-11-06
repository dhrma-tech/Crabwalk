import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { getLocale } from '#lib/paraglide/runtime.js';
import { session } from '#lib/server/auth.ts';
import { nearby, type Lang } from '#lib/server/listings.ts';
import {
	describeStops,
	editTrip,
	startPoints,
	suggestOrder,
	tripView
} from '#lib/server/planner/trips.ts';
import { addDays, istToday } from '#lib/server/planner/data.ts';
import { loadProfile, plannerDefaults } from '#lib/server/profile.ts';
import { workspaceView } from '#lib/server/planner/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

// Plan view (FRONTEND §7.9): owner and editors edit, viewers read (P11 §6); share links; publish route. Group
// votes moved into the trip chat as polls (P12 step G).
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
	// Tripmates open it with their role (P11 §6); RLS already hides the trip from everyone else.
	const { data: me } = t
		? await db
				.from('trip_members')
				.select('role')
				.eq('trip_id', t.id)
				.eq('user_id', s.user.id)
				.maybeSingle()
		: { data: null };
	const role = t?.owner_id === s.user.id || s.isAdmin ? 'owner' : (me?.role ?? null);
	if (!t || !role) error(404, 'not found');
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

	// Trip setup (the planner questions on one screen): owner and editors only. A new, still-empty trip is prefilled
	// from the profile quiz, like the old planner form.
	const canEdit = role === 'owner' || role === 'editor';
	const blank = !t.start_point;
	const defaults = canEdit && blank ? plannerDefaults(await loadProfile(db, s.user.id)) : null;
	const setup = canEdit
		? {
				starts: await startPoints(db),
				tomorrow: addDays(istToday(), 1).date,
				values: {
					days: t.days,
					start_date: t.start_date,
					start: t.start_point as { label: string; lon: number; lat: number } | null,
					group_type: t.group_type ?? defaults?.group_type ?? null,
					people: budget?.people ?? null,
					budget: t.budget,
					interests: blank && !t.interests.length ? (defaults?.interests ?? []) : t.interests,
					pace: t.pace,
					standout: t.standout,
					diet: (t.diet ?? defaults?.diet ?? null) as 'veg' | 'non_veg' | 'jain' | null
				},
				hasStops: t.trip_stops.length > 0
			}
		: null;

	const route = Array.isArray(t.published_routes) ? t.published_routes[0] : t.published_routes;
	const workspace = await workspaceView(
		db,
		t.id,
		t.trip_stops as { entity_type: 'place' | 'stay' | 'eatery'; entity_id: string }[],
		lang
	);
	// The owner's live invite links (one per role), so the share sheet can copy them without a round trip.
	const { data: invites } =
		role === 'owner'
			? await db
					.from('trip_invites')
					.select('role, token')
					.eq('trip_id', t.id)
					.is('revoked_at', null)
			: { data: [] };
	return {
		...view,
		...workspace,
		role,
		invites: invites ?? [],
		add,
		shareToken: t.share_token,
		published: (route as { status: string } | null)?.status ?? null,
		isAdmin: s.isAdmin,
		setup
	};
};

export const actions: Actions = {
	// Pattern analysis: better stop order for a day (BACKEND §10.6). Preview first; apply re-times the day.
	suggest: async (event) => {
		await session(event);
		const day = Number((await event.request.formData()).get('day'));
		const r = await suggestOrder(event.locals.supabase, event.params.id, day);
		return { suggest: { day, savedMin: r?.savedMin ?? 0, names: r?.names ?? [] } };
	},
	applyOrder: async (event) => {
		await session(event);
		const day = Number((await event.request.formData()).get('day'));
		const r = await suggestOrder(event.locals.supabase, event.params.id, day);
		if (r?.days) await editTrip(event.locals.supabase, event.params.id, { days: r.days });
		return { ordered: true };
	},
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
