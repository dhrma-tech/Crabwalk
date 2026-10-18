import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { getLocale } from '#lib/paraglide/runtime.js';
import { session } from '#lib/server/auth.ts';
import type { Lang } from '#lib/server/listings.ts';
import { addDays, istToday } from '#lib/server/planner/data.ts';
import { editTrip, tripView } from '#lib/server/planner/trips.ts';
import type { Actions, PageServerLoad } from './$types';

const find = (db: App.Locals['supabase'], slug: string) => {
	const q = db.from('trips').select('*, trip_stops(*), trip_budget(*)');
	return (z.uuid().safeParse(slug).success ? q.eq('id', slug) : q.eq('slug', slug)).maybeSingle();
};

// Ready-made itinerary / approved route (public via RLS). "Plan this trip" copies it for a chosen date.
export const load: PageServerLoad = async ({ params, locals }) => {
	const { data: t } = await find(locals.supabase, params.slug);
	if (!t) error(404, 'not found');
	const budget = Array.isArray(t.trip_budget) ? (t.trip_budget[0] ?? null) : t.trip_budget;
	return {
		...(await tripView(locals.supabase, t, t.trip_stops, budget, getLocale() as Lang)),
		signedIn: !!(await locals.getUser()),
		tomorrow: addDays(istToday(), 1).date
	};
};

export const actions: Actions = {
	copy: async (event) => {
		const { user } = await session(event);
		const date = z.iso.date().safeParse((await event.request.formData()).get('start_date'));
		if (!date.success) return fail(400);
		const db = event.locals.supabase;
		const { data: t } = await find(db, event.params.slug);
		if (!t) error(404, 'not found');
		const { data: mine, error: e } = await db
			.from('trips')
			.insert({
				owner_id: user.id,
				title: t.title,
				days: t.days,
				start_date: date.data,
				start_point: t.start_point,
				budget: t.budget,
				group_type: t.group_type,
				interests: t.interests,
				pace: t.pace,
				standout: t.standout,
				diet: t.diet
			})
			.select('id')
			.single();
		if (e) return fail(400);
		const days = Array.from({ length: t.days }, (_, d) =>
			[...t.trip_stops]
				.filter((s) => s.day === d + 1)
				.sort((a, b) => a.order - b.order)
				.map((s) => ({ kind: s.kind, entity_id: s.entity_id }))
		);
		const tb = Array.isArray(t.trip_budget) ? t.trip_budget[0] : t.trip_budget;
		// Re-time for the chosen date (hours/tides of those days); conflicts are flagged on the stops.
		await editTrip(db, mine.id, {
			days,
			start_date: date.data,
			budget: {
				people: tb?.people ?? 1,
				fuel_price: tb?.fuel_price ?? null,
				vehicle_mileage_kmpl: tb?.vehicle_mileage_kmpl ?? null,
				activities: tb?.activities ?? 0
			}
		});
		redirect(303, `/plan/${mine.id}`);
	}
};
