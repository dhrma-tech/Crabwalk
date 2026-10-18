import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { getLocale } from '#lib/paraglide/runtime.js';
import { requireStaff } from '#lib/server/auth.ts';
import type { Lang } from '#lib/server/listings.ts';
import { tripView } from '#lib/server/planner/trips.ts';
import type { Actions, PageServerLoad } from './$types';

type Shared = { trip: Parameters<typeof tripView>[1]; stops: Parameters<typeof tripView>[2] };

// Custom routes: users submit, reviewers approve before they appear in /itineraries (PLAN P7 task 10).
export const load: PageServerLoad = async (event) => {
	await requireStaff(event, 'reviewer');
	const db = event.locals.supabase;
	const lang = getLocale() as Lang;
	const { data: pending } = await db
		.from('published_routes')
		.select('trip_id')
		.eq('status', 'pending_review')
		.order('created_at')
		.limit(30);
	const routes = await Promise.all(
		(pending ?? []).map(async (p) => {
			const { data } = await db.rpc('get_route_for_review', { _trip: p.trip_id });
			const d = data as Shared | null;
			return {
				trip_id: p.trip_id,
				view: d ? await tripView(db, d.trip, d.stops, null, lang) : null
			};
		})
	);
	return { routes };
};

export const actions: Actions = {
	review: async (event) => {
		const s = await requireStaff(event, 'reviewer');
		const f = await event.request.formData();
		const id = z.uuid().safeParse(f.get('trip_id'));
		const status = z.enum(['approved', 'rejected']).safeParse(f.get('status'));
		if (!id.success || !status.success) return fail(400);
		const { error } = await event.locals.supabase
			.from('published_routes')
			.update({ status: status.data, reviewed_by: s.user.id })
			.eq('trip_id', id.data);
		if (error) return fail(403);
	}
};
