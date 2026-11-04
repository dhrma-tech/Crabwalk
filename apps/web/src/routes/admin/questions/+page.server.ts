import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { getLocale } from '#lib/paraglide/runtime.js';
import { requireStaff } from '#lib/server/auth.ts';
import { tr, type Lang } from '#lib/server/listings.ts';
import type { Actions, PageServerLoad } from './$types';

// Ask our team (P12 step E, product plan 10.1): verifiers and admins answer travellers' questions Crabby couldn't
// answer from our data. Answers are stored as verified Q&A and reused by Crabby for everyone; time-sensitive ones
// (roads, closures, timings) get an expiry. Oldest first.
export const load: PageServerLoad = async (event) => {
	await requireStaff(event);
	const db = event.locals.supabase;
	const lang = getLocale() as Lang;
	const cols = 'id, question, lang, status, answer, answered_at, expires_at, entity_id, created_at';
	const [{ data: open }, { data: answered }] = await Promise.all([
		db.from('team_questions').select(cols).eq('status', 'open').order('created_at').limit(100),
		db
			.from('team_questions')
			.select(cols)
			.eq('status', 'answered')
			.order('answered_at', { ascending: false })
			.limit(30)
	]);
	const ids = [...(open ?? []), ...(answered ?? [])].flatMap((q) =>
		q.entity_id ? [q.entity_id] : []
	);
	const { data: places } = ids.length
		? await db.from('places').select('id, slug, place_translations(lang, name)').in('id', ids)
		: { data: [] };
	const place = new Map(
		(places ?? []).map((p) => [
			p.id,
			{ slug: p.slug, name: tr(p.place_translations, lang) ?? p.slug }
		])
	);
	const view = (q: NonNullable<typeof open>[number]) => ({
		...q,
		place: q.entity_id ? (place.get(q.entity_id) ?? null) : null
	});
	return { open: (open ?? []).map(view), answered: (answered ?? []).map(view) };
};

const answer = z.object({
	id: z.uuid(),
	answer: z.string().trim().min(2).max(2000),
	// Time-sensitive answers stop being reused after this date (end of that day, IST).
	until: z.union([z.literal(''), z.iso.date()])
});

export const actions: Actions = {
	answer: async (event) => {
		await requireStaff(event);
		const b = answer.safeParse(Object.fromEntries(await event.request.formData()));
		if (!b.success) return fail(400, { error: 'answer' });
		const { error } = await event.locals.supabase
			.from('team_questions')
			.update({
				status: 'answered',
				answer: b.data.answer,
				answered_at: new Date().toISOString(),
				expires_at: b.data.until ? `${b.data.until}T23:59:59+05:30` : null
			})
			.eq('id', b.data.id)
			.eq('status', 'open');
		if (error) return fail(403);
		return { answered: b.data.id };
	},
	close: async (event) => {
		await requireStaff(event);
		const id = z.uuid().safeParse((await event.request.formData()).get('id'));
		if (!id.success) return fail(400);
		const { error } = await event.locals.supabase
			.from('team_questions')
			.update({ status: 'closed' })
			.eq('id', id.data)
			.eq('status', 'open');
		if (error) return fail(403);
	},
	// Stop Crabby reusing an answer that is out of date.
	expire: async (event) => {
		await requireStaff(event);
		const id = z.uuid().safeParse((await event.request.formData()).get('id'));
		if (!id.success) return fail(400);
		const { error } = await event.locals.supabase
			.from('team_questions')
			.update({ expires_at: new Date().toISOString() })
			.eq('id', id.data);
		if (error) return fail(403);
	}
};
