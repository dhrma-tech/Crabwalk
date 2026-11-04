// Apply / discard a Crabby preview (FRONTEND §6.7 ActionPreviewCard). Nothing changes before Apply;
// applying re-runs our own code (planner, trip edit) with the stored payload — never the LLM.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/db.types.ts';
import { lonLat } from '../listings.ts';
import { createTrip, editInput, editTrip, planInput } from '../planner/trips.ts';
import { addToDay } from '../planner/workspace.ts';
import { loadProfile, plannerDefaults } from '../profile.ts';

type DB = SupabaseClient<Database>;

export async function decide(db: DB, userId: string, id: string, apply: boolean) {
	const { data: a } = await db
		.from('ai_actions')
		.select('id, type, preview, status')
		.eq('id', id)
		.eq('user_id', userId)
		.maybeSingle();
	if (!a || a.status !== 'proposed') return { status: 404 as const };
	let href: string | null = null;

	if (apply) {
		const payload = (a.preview as { payload?: unknown }).payload as Record<string, unknown>;
		switch (a.type) {
			case 'create_plan': {
				const p = planInput.parse(payload);
				const { mileage } = plannerDefaults(await loadProfile(db, userId));
				href = `/plan/${(await createTrip(db, userId, p, { mileage })).id}`;
				break;
			}
			case 'edit_plan': {
				const tripId = String(payload.trip_id);
				const e = editInput.parse({ days: payload.days });
				if (!(await editTrip(db, tripId, e))) return { status: 404 as const };
				href = `/plan/${tripId}`;
				break;
			}
			case 'open_map':
				href = `/map?q=${encodeURIComponent(String(payload.name))}`;
				break;
			case 'start_nav': {
				// In-app navigation (P9); it offers the Google Maps hand-off for long drives.
				const { data: p } = await db
					.from('places')
					.select('location')
					.eq('slug', String(payload.slug))
					.maybeSingle();
				const c = p ? lonLat(p.location) : null;
				if (!c) return { status: 404 as const };
				href = `/navigate?to=${c[1]},${c[0]}&name=${encodeURIComponent(String(payload.name ?? ''))}`;
				break;
			}
			case 'shortlist_stays':
				href = null; // the preview already lists the stays + booking links
				break;
			case 'ask_team': {
				// Filed for verifiers (10.1); the answer reaches the user in Crabby + by push.
				const { error } = await db.from('team_questions').insert({
					question: String(payload.question),
					lang: payload.lang as 'en' | 'hi' | 'mr',
					...(payload.entity_id
						? { entity_type: 'place' as const, entity_id: String(payload.entity_id) }
						: {})
				});
				if (error) return { status: 404 as const };
				href = null;
				break;
			}
			case 'add_to_trip': {
				// Same path as the listing pages' "Add to trip" (P11 addToDay): re-timed like any edit.
				const tripId = String(payload.trip_id);
				const type = payload.type as 'place' | 'stay' | 'eatery';
				if (!(await addToDay(db, tripId, type, String(payload.entity_id), Number(payload.day))))
					return { status: 404 as const };
				href = `/plan/${tripId}`;
				break;
			}
			case 'save_share': {
				const tripId = String(payload.trip_id);
				const { data: t, error } = await db
					.from('trips')
					.update({ status: 'saved' })
					.eq('id', tripId)
					.select('share_token')
					.single();
				if (error || !t) return { status: 404 as const };
				href = `/plan/share/${t.share_token}`;
				break;
			}
		}
	}
	const { error } = await db
		.from('ai_actions')
		.update({ status: apply ? 'applied' : 'discarded' })
		.eq('id', id);
	if (error) throw error;
	return { status: 200 as const, href };
}
