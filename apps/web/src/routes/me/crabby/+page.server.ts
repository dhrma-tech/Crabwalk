import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { getLocale } from '#lib/paraglide/runtime.js';
import { ACTIVITY_COOKIE } from '#lib/activity.ts';
import { session } from '#lib/server/auth.ts';
import type { Lang } from '#lib/server/listings.ts';
import { lineText, loadProfile, refreshProfile, type Line } from '#lib/server/profile.ts';
import type { Actions, PageServerLoad } from './$types';

// Crabby & you (P12 step D, product plan 10.7 + 10.9): the quiz, "What Crabby thinks about you" (correct or delete
// any line, or reset), where Crabby learns from (one switch per source; off deletes what it taught), and its style.
export const load: PageServerLoad = async (event) => {
	const { user } = await session(event);
	const db = event.locals.supabase;
	let p = await loadProfile(db, user.id);
	if (!p) {
		const { data, error } = await db
			.from('user_profile')
			.insert({ user_id: user.id })
			.select('*')
			.single();
		if (error) throw error;
		p = data;
	}
	p = await refreshProfile(db, user.id, p);
	const lang = getLocale() as Lang;
	return {
		profile: p,
		lines: ((p.lines as Line[]) ?? [])
			.filter((l) => !l.hidden)
			.map((l) => ({ id: l.id, source: l.source, text: lineText(l, lang) }))
	};
};

const opt = <T extends z.ZodType>(t: T) => z.union([z.literal('').transform(() => null), t]);
const quiz = z.object({
	vehicle: opt(z.enum(['car', 'two_wheeler', 'public_transport'])),
	mileage_kmpl: opt(z.coerce.number().min(5).max(100)),
	budget_band: opt(z.enum(['budget', 'mid', 'premium'])),
	interests: z
		.array(
			z.enum([
				'beach',
				'fort',
				'temple',
				'waterfall',
				'viewpoint',
				'backwater',
				'cave',
				'museum',
				'village',
				'market',
				'orchard'
			])
		)
		.max(11),
	pace: opt(z.enum(['relaxed', 'balanced', 'packed'])),
	diet: opt(z.enum(['veg', 'non_veg', 'jain'])),
	seafood: z.enum(['', 'yes', 'no']).transform((v) => (v ? v === 'yes' : null)),
	group_type: opt(z.enum(['family', 'couple', 'solo', 'friends']))
});

async function lines(event: Parameters<Actions[string]>[0], userId: string) {
	const p = await loadProfile(event.locals.supabase, userId);
	return { p, lines: ((p?.lines as Line[]) ?? []) as Line[] };
}

export const actions: Actions = {
	quiz: async (event) => {
		const { user } = await session(event);
		const f = await event.request.formData();
		const b = quiz.safeParse({ ...Object.fromEntries(f), interests: f.getAll('interests') });
		if (!b.success) return fail(400, { quiz: 'invalid' });
		const { error } = await event.locals.supabase
			.from('user_profile')
			.update({ ...b.data, quiz_done_at: new Date().toISOString() })
			.eq('user_id', user.id);
		if (error) return fail(403);
		return { saved: 'quiz' };
	},
	// One switch per source (DPDPA). Turning one off deletes what it collected (DB trigger).
	sources: async (event) => {
		const { user } = await session(event);
		const f = await event.request.formData();
		const on = (k: string) => f.get(k) === 'on';
		const { error } = await event.locals.supabase
			.from('user_profile')
			.update({
				use_quiz: on('use_quiz'),
				use_activity: on('use_activity'),
				use_chats: on('use_chats'),
				use_trips: on('use_trips'),
				use_photos: on('use_photos')
			})
			.eq('user_id', user.id);
		if (error) return fail(403);
		event.cookies.set(ACTIVITY_COOKIE, on('use_activity') ? '1' : '0', {
			path: '/',
			httpOnly: false,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 365
		});
		return { saved: 'sources' };
	},
	persona: async (event) => {
		const { user } = await session(event);
		const v = (await event.request.formData()).get('persona');
		if (v !== 'playful' && v !== 'plain') return fail(400);
		const { error } = await event.locals.supabase
			.from('user_profile')
			.update({ persona: v })
			.eq('user_id', user.id);
		if (error) return fail(403);
		return { saved: 'persona' };
	},
	// Delete a line: computed ones stay hidden on every refresh; chat / own lines are removed.
	hide: async (event) => {
		const { user } = await session(event);
		const id = String((await event.request.formData()).get('id') ?? '');
		const { lines: all } = await lines(event, user.id);
		const next = all.flatMap((l) =>
			l.id !== id ? [l] : l.source === 'chat' || l.source === 'user' ? [] : [{ ...l, hidden: true }]
		);
		await event.locals.supabase
			.from('user_profile')
			.update({ lines: next as never })
			.eq('user_id', user.id);
	},
	// Correct a line: the user's words replace it.
	edit: async (event) => {
		const { user } = await session(event);
		const f = await event.request.formData();
		const id = String(f.get('id') ?? '');
		const text = String(f.get('text') ?? '')
			.trim()
			.slice(0, 120);
		if (!text) return fail(400);
		const { lines: all } = await lines(event, user.id);
		const next = all.flatMap((l): Line[] => {
			if (l.id !== id) return [l];
			const mine: Line = { id: `user:${crypto.randomUUID().slice(0, 8)}`, source: 'user', text };
			return l.source === 'chat' || l.source === 'user' ? [mine] : [{ ...l, hidden: true }, mine];
		});
		await event.locals.supabase
			.from('user_profile')
			.update({ lines: next as never })
			.eq('user_id', user.id);
	},
	// Forget everything: activity log and the whole profile (a fresh one starts with sources off).
	reset: async (event) => {
		const { user } = await session(event);
		const db = event.locals.supabase;
		await db.from('user_activity').delete().eq('user_id', user.id);
		const { error } = await db.from('user_profile').delete().eq('user_id', user.id);
		if (error) return fail(403);
		event.cookies.set(ACTIVITY_COOKIE, '0', { path: '/', httpOnly: false, sameSite: 'lax' });
		return { saved: 'reset' };
	}
};
