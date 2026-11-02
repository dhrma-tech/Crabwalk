import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { session } from '#lib/server/auth.ts';
import { editTrip } from '#lib/server/planner/trips.ts';
import type { RequestHandler } from './$types';

// POST /api/trips/:id/add { type, slug, day } — "Add to trip" from a listing page (DECISIONS T-4 / T-47).
// A place joins the day's stops, food joins as a meal, a stay becomes that night's stay (replacing any other).
// Places and meals go before the night's stay. Then the trip is re-timed like any edit: stops that no longer fit
// their hours are flagged on the plan, never dropped. Owner only (RLS); the listing must be published.
const body = z.object({
	type: z.enum(['place', 'stay', 'eatery']),
	slug: z.string().min(1).max(200),
	day: z.number().int().min(1).max(7)
});
const TABLE = { place: 'places', stay: 'stays', eatery: 'eateries' } as const;
const KIND = { place: 'place', stay: 'stay', eatery: 'meal' } as const;

export const POST: RequestHandler = async (event) => {
	await session(event);
	const b = body.safeParse(await event.request.json().catch(() => null));
	if (!z.uuid().safeParse(event.params.id).success || !b.success) error(400, 'bad request');
	const db = event.locals.supabase;
	const [{ data: trip }, { data: listing }] = await Promise.all([
		db
			.from('trips')
			.select('days, status, trip_stops(day, order, kind, entity_id)')
			.eq('id', event.params.id)
			.maybeSingle(),
		db
			.from(TABLE[b.data.type])
			.select('id')
			.eq('slug', b.data.slug)
			.eq('status', 'published')
			.maybeSingle()
	]);
	if (!trip || !listing) error(404, 'not found');
	if (trip.status === 'completed' || b.data.day > trip.days) error(409, 'trip cannot take this');

	const days = Array.from({ length: trip.days }, (_, d) =>
		trip.trip_stops
			.filter((s) => s.day === d + 1)
			.sort((a, b) => a.order - b.order)
			.map((s) => ({ kind: s.kind, entity_id: s.entity_id }))
	);
	const day = days[b.data.day - 1]!;
	const kind = KIND[b.data.type];
	if (!day.some((s) => s.entity_id === listing.id)) {
		if (kind === 'stay') {
			const rest = day.filter((s) => s.kind !== 'stay');
			day.splice(0, day.length, ...rest, { kind, entity_id: listing.id });
		} else {
			const night = day.findIndex((s) => s.kind === 'stay');
			day.splice(night < 0 ? day.length : night, 0, { kind, entity_id: listing.id });
		}
	}
	if (day.length > 30) error(409, 'day is full');
	if (!(await editTrip(db, event.params.id, { days }))) error(404, 'not found');
	return json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
};
