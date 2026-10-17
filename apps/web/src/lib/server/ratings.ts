// Rating engine read/write (BACKEND §5 [LOCKED]). Aggregates come from verdict_agg (trigger-maintained);
// individual verdicts/sub-scores stay private (RLS). Hygiene/cleanliness gate is enforced in the DB.
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Constants, type Database } from '#lib/db.types.ts';

type DB = SupabaseClient<Database>;
export type EntityType = 'place' | 'stay' | 'eatery';
export type Group = Database['public']['Enums']['group_type'];
export type Agg = {
	counts: number[];
	total: number;
	winner_level: number | null;
	winner_pct: number | null;
	is_new: boolean;
};

export const GROUPS = Constants.public.Enums.group_type;
export const DIMENSIONS: Record<EntityType, string[]> = {
	place: [],
	eatery: ['taste', 'authenticity', 'hygiene', 'value'],
	stay: ['cleanliness', 'value', 'host', 'location']
};
export const VERIFIED_ONLY = ['hygiene', 'cleanliness'];
const TABLE = { place: 'places', stay: 'stays', eatery: 'eateries' } as const;

const toAgg = (r: {
	counts: number[] | null;
	total: number | null;
	winner_level: number | null;
	winner_pct: number | null;
	is_new: boolean | null;
}): Agg => ({
	counts: r.counts ?? [0, 0, 0, 0],
	total: r.total ?? 0,
	winner_level: r.winner_level,
	winner_pct: r.winner_pct != null ? Number(r.winner_pct) : null,
	is_new: r.is_new ?? true
});

/** Everything the gauge + vote UI needs for one listing. */
export async function ratingsFor(db: DB, type: EntityType, id: string, userId: string | null) {
	const [groups, all, subs, reviews, summary, mine, mySubs, visit, myProof] = await Promise.all([
		db.from('verdict_agg').select('*').eq('entity_type', type).eq('entity_id', id),
		db
			.from('verdict_agg_all')
			.select('*')
			.eq('entity_type', type)
			.eq('entity_id', id)
			.maybeSingle(),
		db.rpc('sub_score_summary', { _type: type, _id: id }),
		db
			.from('reviews')
			.select('id, group_type, text, created_at, review_photos(id, storage_path, lqip)')
			.eq('entity_type', type)
			.eq('entity_id', id)
			.eq('moderation_status', 'approved')
			.order('created_at', { ascending: false })
			.limit(20),
		db.from('review_summaries').select('lang, summary').eq('entity_type', type).eq('entity_id', id),
		userId
			? db
					.from('verdicts')
					.select('group_type, level')
					.eq('entity_type', type)
					.eq('entity_id', id)
					.eq('user_id', userId)
			: Promise.resolve({ data: [] }),
		userId
			? db
					.from('sub_scores')
					.select('dimension, score')
					.eq('entity_type', type)
					.eq('entity_id', id)
					.eq('user_id', userId)
			: Promise.resolve({ data: [] }),
		userId
			? db
					.from('verified_visits')
					.select('id')
					.eq('entity_type', type)
					.eq('entity_id', id)
					.eq('user_id', userId)
					.limit(1)
			: Promise.resolve({ data: [] }),
		userId && type !== 'place'
			? db
					.from('booking_proofs')
					.select('id')
					.eq('entity_type', type)
					.eq('entity_id', id)
					.eq('user_id', userId)
					.eq('status', 'pending')
					.limit(1)
			: Promise.resolve({ data: [] })
	]);
	return {
		groups: Object.fromEntries((groups.data ?? []).map((g) => [g.group_type, toAgg(g)])) as Partial<
			Record<Group, Agg>
		>,
		all: all.data ? toAgg(all.data) : null,
		subs: (subs.data ?? []).map((s) => ({
			dimension: s.dimension,
			avg: Number(s.avg_score),
			n: s.n
		})),
		reviews: reviews.data ?? [],
		summaries: summary.data ?? [],
		mine: {
			verdicts: Object.fromEntries(
				(mine.data ?? []).map((v) => [v.group_type, v.level])
			) as Partial<Record<Group, number>>,
			subs: Object.fromEntries((mySubs.data ?? []).map((s) => [s.dimension, s.score])) as Record<
				string,
				number
			>,
			verified: !!visit.data?.length,
			proofPending: !!myProof.data?.length
		},
		signedIn: !!userId
	};
}

/** All-groups aggregate for a set of listings (cards' mini verdict bar). */
export async function cardAggs(db: DB, type: EntityType, ids: string[]) {
	if (!ids.length) return new Map<string, Agg>();
	const { data } = await db
		.from('verdict_agg_all')
		.select('*')
		.eq('entity_type', type)
		.in('entity_id', ids);
	return new Map((data ?? []).map((r) => [r.entity_id!, toAgg(r)]));
}

export async function assertPublished(db: DB, type: EntityType, id: string) {
	const { data } = await db
		.from(TABLE[type])
		.select('id')
		.eq('id', id)
		.eq('status', 'published')
		.maybeSingle();
	return !!data;
}

const entity = { entity_type: z.enum(['place', 'stay', 'eatery']), entity_id: z.uuid() };
export const verdictInput = z.object({
	...entity,
	group_type: z.enum(GROUPS),
	level: z.number().int().min(1).max(4)
});
export const subScoreInput = z.object({
	...entity,
	scores: z.partialRecord(
		z.enum(Constants.public.Enums.sub_score_dimension),
		z.number().int().min(0).max(5)
	)
});
