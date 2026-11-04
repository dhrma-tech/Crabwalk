import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { getLocale } from '#lib/paraglide/runtime.js';
import { requireStaff } from '#lib/server/auth.ts';
import { tr, type Lang } from '#lib/server/listings.ts';
import type { Actions, PageServerLoad } from './$types';

const head = { count: 'exact', head: true } as const;
const n = (q: PromiseLike<{ count: number | null }>) =>
	Promise.resolve(q).then((r) => r.count ?? 0);

// Field-team hub: queue counter (Report 1 §4.8), monthly re-check queue (PLAN P4 task 4) + links.
// Counts only the queues this role can open; RLS scopes verifiers to their talukas.
export const load: PageServerLoad = async (event) => {
	const s = await requireStaff(event);
	const lang = getLocale() as Lang;
	const db = event.locals.supabase;
	const listings = (t: 'places' | 'stays' | 'eateries') =>
		n(db.from(t).select('id', head).eq('status', 'in_review'));
	const [reports, proofs, review, moderation, routes, claims, questions, requests] =
		await Promise.all([
			n(db.from('reports').select('id', head).in('status', ['new', 'triaged'])),
			n(db.from('booking_proofs').select('id', head).eq('status', 'pending')),
			s.isReviewer
				? Promise.all([listings('places'), listings('stays'), listings('eateries')]).then((c) =>
						c.reduce((a, b) => a + b, 0)
					)
				: null,
			s.isReviewer
				? n(db.from('reviews').select('id', head).eq('moderation_status', 'pending'))
				: null,
			s.isReviewer
				? n(db.from('published_routes').select('trip_id', head).eq('status', 'pending_review'))
				: null,
			s.isAdmin ? n(db.from('owner_claims').select('id', head).eq('status', 'pending')) : null,
			// Ask our team (P12): verifiers and admins answer.
			n(db.from('team_questions').select('id', head).eq('status', 'open')),
			// Availability requests for unclaimed listings, relayed by WhatsApp (P12).
			n(db.from('stay_requests').select('id', head).eq('status', 'sent').neq('user_id', s.user.id))
		]);
	const mine = s.roles.filter((r) => r.role === 'verifier' && r.taluka_id).map((r) => r.taluka_id!);
	let q = db
		.from('places')
		.select('id, slug, next_recheck_at, last_verified_at, place_translations(lang, name)')
		.eq('status', 'published')
		.lte('next_recheck_at', new Date().toISOString())
		.order('next_recheck_at')
		.limit(50);
	if (!s.isReviewer && mine.length) q = q.in('taluka_id', mine);
	const { data } = await q;
	return {
		isReviewer: s.isReviewer,
		isAdmin: s.isAdmin,
		counts: { review, moderation, routes, reports, proofs, claims, questions, requests },
		due: (data ?? []).map((p) => ({
			id: p.id,
			slug: p.slug,
			name: tr(p.place_translations, lang) ?? p.slug,
			last: p.last_verified_at
		}))
	};
};

export const actions: Actions = {
	verified: async (event) => {
		await requireStaff(event);
		const parsed = z.uuid().safeParse((await event.request.formData()).get('id'));
		if (!parsed.success) return fail(400);
		const id = parsed.data;
		const { error } = await event.locals.supabase
			.from('places')
			.update({ last_verified_at: new Date().toISOString() })
			.eq('id', id);
		if (error) return fail(403, { error: true });
	}
};
