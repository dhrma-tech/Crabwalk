import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { getLocale } from '#lib/paraglide/runtime.js';
import { session } from '#lib/server/auth.ts';
import type { Lang } from '#lib/server/listings.ts';
import { addDays, istToday } from '#lib/server/planner/data.ts';
import { editTrip, tripView } from '#lib/server/planner/trips.ts';
import type { Actions, PageServerLoad } from './$types';

// Live trip (FRONTEND §7.11): current stop → next stop + ETA → nudge banners → start navigation.
export const load: PageServerLoad = async (event) => {
	const s = await session(event);
	if (!z.uuid().safeParse(event.params.id).success) error(404, 'not found');
	const db = event.locals.supabase;
	const { data: t } = await db
		.from('trips')
		.select('*, trip_stops(*)')
		.eq('id', event.params.id)
		.maybeSingle();
	if (!t || t.owner_id !== s.user.id) error(404, 'not found');
	const today = istToday();
	// Today's day of the trip; before/after the dates fall back to day 1 / the last day.
	let day = 1;
	if (t.start_date)
		for (let d = 1; d <= t.days; d++) if (addDays(t.start_date, d - 1).date <= today) day = d;
	const { data: consent } = await db
		.from('consents')
		.select('granted, revoked_at')
		.eq('user_id', s.user.id)
		.eq('type', 'dwell_time')
		.maybeSingle();
	const view = await tripView(db, t, t.trip_stops, null, getLocale() as Lang);
	return {
		...view,
		day,
		live: t.live_date === today,
		raw: t.trip_stops
			.filter((x) => x.day === day)
			.sort((a, b) => a.order - b.order)
			.map((x) => ({
				entity_id: x.entity_id,
				kind: x.kind,
				arrive_at: x.arrive_at,
				depart_at: x.depart_at
			})),
		dwellConsent: !!consent?.granted && !consent.revoked_at
	};
};

export const actions: Actions = {
	// Live mode today enables push time nudges (trip-nudges function).
	start: async (event) => {
		await session(event);
		const { error: e } = await event.locals.supabase
			.from('trips')
			.update({ live_date: istToday() })
			.eq('id', event.params.id);
		if (e) return fail(403);
	},
	stop: async (event) => {
		await session(event);
		const { error: e } = await event.locals.supabase
			.from('trips')
			.update({ live_date: null })
			.eq('id', event.params.id);
		if (e) return fail(403);
	},
	// "Running late — skip X?" → remove that stop and re-time the day.
	skip: async (event) => {
		await session(event);
		const f = await event.request.formData();
		const day = Number(f.get('day'));
		const skip = String(f.get('entity_id'));
		const db = event.locals.supabase;
		const { data: t } = await db
			.from('trips')
			.select('days, trip_stops(day, order, kind, entity_id)')
			.eq('id', event.params.id)
			.maybeSingle();
		if (!t) return fail(404);
		const days = Array.from({ length: t.days }, (_, d) =>
			t.trip_stops
				.filter((x) => x.day === d + 1)
				.sort((a, b) => a.order - b.order)
				.filter((x) => !(d + 1 === day && x.entity_id === skip))
				.map((x) => ({ kind: x.kind, entity_id: x.entity_id }))
		);
		await editTrip(db, event.params.id, { days });
		return { skipped: true };
	}
};
