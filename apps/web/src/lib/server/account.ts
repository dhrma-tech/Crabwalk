// Account export and deletion (hardening 2026-11, SEC-15).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/db.types.ts';

type DB = SupabaseClient<Database>;

/** Buckets that keep a traveller's own files under `<user id>/…` (photos of listings belong to the team). */
export const USER_BUCKETS = ['review-photos', 'journal', 'booking-proofs'] as const;

/** Every object path under `prefix/` in a bucket, folders included (Storage lists one level at a time). */
export async function listAll(db: DB, bucket: string, prefix: string): Promise<string[]> {
	const out: string[] = [];
	for (let offset = 0; ; offset += 1000) {
		const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000, offset });
		if (error) throw error;
		for (const e of data ?? []) {
			const path = `${prefix}/${e.name}`;
			// Folders come back without an id.
			if (e.id === null) out.push(...(await listAll(db, bucket, path)));
			else out.push(path);
		}
		if (!data || data.length < 1000) return out;
	}
}

/** Remove all of a user's files from the traveller buckets. Returns how many were removed. */
export async function removeUserFiles(db: DB, userId: string) {
	let n = 0;
	for (const bucket of USER_BUCKETS) {
		const paths = await listAll(db, bucket, userId);
		for (let i = 0; i < paths.length; i += 500) {
			const { error } = await db.storage.from(bucket).remove(paths.slice(i, i + 500));
			if (error) throw error;
		}
		n += paths.length;
	}
	return n;
}

/** The signed-in user's own rows, read with their own client (RLS scopes every query to them). */
export async function exportRows(db: DB, userId: string) {
	const rows = async <T>(q: PromiseLike<{ data: T[] | T | null }>) => (await q).data ?? [];
	const trips = (await rows(db.from('trips').select('*').eq('owner_id', userId))) as {
		id: string;
	}[];
	const ids = trips.map((t) => t.id);
	// Table names vary here; the typed client cannot follow them, so this read uses its untyped view.
	const loose = db as unknown as SupabaseClient;
	const inTrips = (t: string) =>
		ids.length ? rows(loose.from(t).select('*').in('trip_id', ids)) : Promise.resolve([]);
	const [
		profile,
		preferences,
		crabbyProfile,
		consents,
		saved,
		stops,
		lists,
		listItems,
		notes,
		expenses,
		verdicts,
		subScores,
		reviews,
		stayRequests,
		teamQuestions,
		journals
	] = await Promise.all([
		rows(db.from('profiles').select('*').eq('id', userId)),
		rows(db.from('user_preferences').select('*').eq('user_id', userId)),
		rows(db.from('user_profile').select('*').eq('user_id', userId)),
		rows(db.from('consents').select('*').eq('user_id', userId)),
		rows(db.from('saved_items').select('*').eq('user_id', userId)),
		inTrips('trip_stops'),
		inTrips('trip_lists'),
		inTrips('trip_list_items'),
		inTrips('trip_notes'),
		inTrips('trip_expenses'),
		rows(db.from('verdicts').select('*').eq('user_id', userId)),
		rows(db.from('sub_scores').select('*').eq('user_id', userId)),
		rows(db.from('reviews').select('*').eq('user_id', userId)),
		rows(db.from('stay_requests').select('*').eq('user_id', userId)),
		rows(db.from('team_questions').select('*').eq('asker', userId)),
		rows(db.from('trip_journals').select('*').eq('user_id', userId))
	]);
	return {
		exported_at: new Date().toISOString(),
		profile,
		preferences,
		crabby_profile: crabbyProfile,
		consents,
		saved,
		trips: { trips, stops, lists, list_items: listItems, notes, expenses },
		verdicts,
		sub_scores: subScores,
		reviews,
		stay_requests: stayRequests,
		team_questions: teamQuestions,
		journals
	};
}
