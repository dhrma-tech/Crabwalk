// Reviewer workflow (PLAN P4 task 2): text per language goes through content_drafts → approve_listing.
// AI drafting (P8) will write the same draft rows; until then the reviewer types them.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/db.types.ts';

type DB = SupabaseClient<Database>;
export type ReviewType = 'place' | 'stay' | 'eatery' | 'dish';
export const LANGS = ['en', 'hi', 'mr'] as const;
export const FIELDS: Record<ReviewType, string[]> = {
	place: ['name', 'short_story', 'history', 'significance', 'dos', 'donts', 'safety_text'],
	stay: ['name', 'description'],
	eatery: ['name', 'description'],
	dish: ['name', 'what_it_is', 'story']
};
const TABLE = { place: 'places', stay: 'stays', eatery: 'eateries', dish: 'dishes' } as const;
const TR = {
	place: 'place_translations',
	stay: 'stay_translations',
	eatery: 'eatery_translations',
	dish: 'dish_translations'
} as const;

export const isReviewType = (t: string): t is ReviewType => t in TABLE;

/** Current text per lang/field: pending draft if any, else the published translation. */
export async function loadText(db: DB, type: ReviewType, id: string) {
	const fk = `${type}_id`;
	const [{ data: tr }, { data: drafts }] = await Promise.all([
		db
			.from(TR[type])
			.select('*')
			.eq(fk as never, id as never),
		db
			.from('content_drafts')
			.select('lang, field, draft_text')
			.eq('entity_type', type)
			.eq('entity_id', id)
			.eq('status', 'draft')
	]);
	const out: Record<string, Record<string, string>> = { en: {}, hi: {}, mr: {} };
	for (const row of (tr ?? []) as unknown as Record<string, string>[])
		for (const f of FIELDS[type]) if (row[f]) out[row.lang][f] = row[f];
	for (const d of drafts ?? []) out[d.lang][d.field] = d.draft_text;
	return out;
}

/** Replaces the pending drafts with the submitted text (every non-empty field). */
export async function saveDrafts(db: DB, type: ReviewType, id: string, form: FormData) {
	await db
		.from('content_drafts')
		.delete()
		.eq('entity_type', type)
		.eq('entity_id', id)
		.eq('status', 'draft');
	const rows = LANGS.flatMap((lang) =>
		FIELDS[type]
			.map((field) => ({
				lang,
				field,
				text: String(form.get(`${lang}.${field}`) ?? '')
					.trim()
					.slice(0, 10000)
			}))
			.filter((x) => x.text)
			.map((x) => ({
				entity_type: type,
				entity_id: id,
				lang: x.lang,
				field: x.field,
				draft_text: x.text
			}))
	);
	if (rows.length) {
		const { error } = await db.from('content_drafts').insert(rows);
		if (error) throw error;
	}
}

export async function publish(db: DB, type: ReviewType, id: string) {
	const { error } = await db.rpc('approve_listing', { _type: type, _id: id });
	if (error) throw error;
}

export async function entity(db: DB, type: ReviewType, id: string) {
	const { data } = await db.from(TABLE[type]).select('*').eq('id', id).maybeSingle();
	return data as Record<string, unknown> | null;
}
