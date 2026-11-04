import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { getLocale } from '#lib/paraglide/runtime.js';
import { session } from '#lib/server/auth.ts';
import type { Lang } from '#lib/server/listings.ts';
import { journalData, writeStory } from '#lib/server/journal.ts';
import { loadProfile } from '#lib/server/profile.ts';
import type { Actions, PageServerLoad } from './$types';

// Trip journal (P12 step M, 10.10): the user's own journal for a trip they own or joined (one per user per trip).
export const load: PageServerLoad = async (event) => {
	const s = await session(event);
	const id = z.uuid().safeParse(event.params.id);
	if (!id.success) error(404, 'not found');
	const db = event.locals.supabase;
	const data = await journalData(db, id.data, s.user.id, getLocale() as Lang);
	if (!data) error(404, 'not found');
	const { data: j } = await db
		.from('trip_journals')
		.select(
			'id, status, answers, story, share_token, journal_photos(id, path, caption, created_at)'
		)
		.eq('trip_id', id.data)
		.eq('user_id', s.user.id)
		.maybeSingle();
	return {
		tripId: id.data,
		trip: data,
		journal: j
			? {
					...j,
					answers: (j.answers ?? {}) as Record<string, string>,
					journal_photos: [...j.journal_photos].sort((a, b) =>
						a.created_at.localeCompare(b.created_at)
					)
				}
			: null
	};
};

const answers = z
	.record(z.string().max(60), z.string().trim().max(1500))
	.refine((a) => Object.keys(a).length <= 60);

/** The user's journal row for this trip, created on first use. */
async function ensure(event: Parameters<Actions[string]>[0]) {
	const s = await session(event);
	const db = event.locals.supabase;
	const tripId = event.params.id!;
	const { data: j } = await db
		.from('trip_journals')
		.select('id, answers')
		.eq('trip_id', tripId)
		.eq('user_id', s.user.id)
		.maybeSingle();
	if (j) return { s, db, tripId, j };
	const { data: n } = await db
		.from('trip_journals')
		.insert({ trip_id: tripId, lang: getLocale() as Lang })
		.select('id, answers')
		.single();
	return n ? { s, db, tripId, j: n } : null;
}

export const actions: Actions = {
	save: async (event) => {
		const a = answers.safeParse(
			JSON.parse(String((await event.request.formData()).get('answers') ?? '{}'))
		);
		if (!a.success) return fail(400);
		const x = await ensure(event);
		if (!x) return fail(403);
		const { error: e } = await x.db
			.from('trip_journals')
			.update({ answers: a.data, status: 'interview' })
			.eq('id', x.j.id);
		return e ? fail(403) : { saved: true };
	},
	write: async (event) => {
		const x = await ensure(event);
		if (!x) return fail(403);
		const lang = getLocale() as Lang;
		const d = await journalData(x.db, x.tripId, x.s.user.id, lang);
		if (!d) return fail(404);
		const persona = (await loadProfile(x.db, x.s.user.id))?.persona ?? 'playful';
		const story = await writeStory(
			x.db,
			d,
			(x.j.answers ?? {}) as Record<string, string>,
			lang,
			persona
		);
		if (!story) return fail(429, { limit: true });
		await x.db.from('trip_journals').update({ story, status: 'written', lang }).eq('id', x.j.id);
		return { written: true };
	},
	share: async (event) => {
		const on = (await event.request.formData()).get('on') === '1';
		const x = await ensure(event);
		if (!x) return fail(403);
		const token = on
			? btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))).replace(
					/[+/=]/g,
					(c) => ({ '+': '-', '/': '_', '=': '' })[c]!
				)
			: null;
		const { error: e } = await x.db
			.from('trip_journals')
			.update({ share_token: token })
			.eq('id', x.j.id);
		return e ? fail(403) : { shared: on };
	}
};
