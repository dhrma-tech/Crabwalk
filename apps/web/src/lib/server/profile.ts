// Personal profile (P12 step D, product plan 10.7). Computed by code from the sources the user switched on in
// Me — quiz, in-app activity (views, searches, saves), Crabby chats (stated preferences only), trips + QR visits —
// into short "What Crabby thinks about you" lines the user can correct or delete. Only a summary of the visible
// lines reaches the LLM: never raw activity, chat history or personal data (AI firewall, CLAUDE.md §2).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/db.types.ts';
import { msg } from '#lib/msg.ts';
import type { Lang } from './listings.ts';
import type { Msg } from './ai/providers.ts';
import { chain, route } from './ai/router.ts';

type DB = SupabaseClient<Database>;
export type Profile = Database['public']['Tables']['user_profile']['Row'];
export type Source = 'quiz' | 'activity' | 'chat' | 'trips' | 'user';
export type Line = {
	id: string;
	source: Source;
	/** Computed lines: a message key + params, rendered in the reader's language. */
	key?: string;
	params?: Record<string, string | number | string[]>;
	/** Chat-extracted or user-written lines: plain text. */
	text?: string;
	hidden?: boolean;
};
const CATS = [
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
] as const;
type Cat = (typeof CATS)[number];
const DAY = 864e5;

export async function loadProfile(db: DB, userId: string): Promise<Profile | null> {
	const { data } = await db.from('user_profile').select('*').eq('user_id', userId).maybeSingle();
	return data;
}

const cats = (xs: string[], lang: Lang) => xs.map((c) => msg(`cat_${c}`, {}, lang)).join(', ');
/** A line in the reader's language (the LLM summary is built with 'en'). */
export function lineText(l: Line, lang: Lang): string {
	if (l.text) return l.text;
	const p = l.params ?? {};
	switch (l.key) {
		case 'prof_vehicle':
			return msg(
				p.kmpl ? 'prof_vehicle_kmpl' : 'prof_vehicle',
				{ vehicle: msg(`vehicle_${p.vehicle}`, {}, lang), kmpl: Number(p.kmpl ?? 0) },
				lang
			);
		case 'prof_budget':
			return msg('prof_budget', { band: msg(`budget_level_${p.band}`, {}, lang) }, lang);
		case 'prof_interests':
		case 'prof_often':
			return msg(l.key, { list: cats(p.cats as string[], lang) }, lang);
		case 'prof_trips':
			return (p.cats as string[]).length
				? msg('prof_trips', { n: p.n as number, list: cats(p.cats as string[], lang) }, lang)
				: msg('prof_trips_n', { n: p.n as number }, lang);
		case 'prof_pace':
			return msg('prof_pace', { pace: msg(`pace_${p.pace}`, {}, lang) }, lang);
		case 'prof_diet':
			return msg(
				'prof_diet',
				{ diet: msg(p.diet === 'non_veg' ? 'diet_nonveg' : `diet_${p.diet}`, {}, lang) },
				lang
			);
		case 'prof_group':
			return msg('prof_group', { group: msg(`group_${p.group}`, {}, lang) }, lang);
		default:
			return l.key ? msg(l.key, p as Record<string, string>, lang) : '';
	}
}

/** Most-seen categories in counts ≥ min, top 3. */
const top = (counts: Map<Cat, number>, min: number) =>
	[...counts]
		.filter(([, n]) => n >= min)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 3)
		.map(([c]) => c);

async function placeCats(db: DB, ids: string[]) {
	if (!ids.length) return new Map<string, Cat>();
	const { data } = await db.from('places').select('id, category').in('id', ids.slice(0, 500));
	return new Map((data ?? []).map((p) => [p.id, p.category as Cat]));
}

/** Recompute the computed lines and scores from the switched-on sources; chat / user lines and hidden flags stay. */
export async function refreshProfile(db: DB, userId: string, p: Profile): Promise<Profile> {
	const old = (p.lines as Line[]) ?? [];
	const hidden = new Set(old.filter((l) => l.hidden).map((l) => l.id));
	const lines: Line[] = [];
	const score = new Map<Cat, number>();
	const bump = (c: Cat, by: number) => score.set(c, Math.min(1, (score.get(c) ?? 0) + by));

	if (p.use_quiz) {
		if (p.vehicle)
			lines.push({
				id: 'quiz:vehicle',
				source: 'quiz',
				key: 'prof_vehicle',
				params: { vehicle: p.vehicle, ...(p.mileage_kmpl ? { kmpl: Number(p.mileage_kmpl) } : {}) }
			});
		if (p.budget_band)
			lines.push({
				id: 'quiz:budget',
				source: 'quiz',
				key: 'prof_budget',
				params: { band: p.budget_band }
			});
		if (p.interests.length) {
			lines.push({
				id: 'quiz:interests',
				source: 'quiz',
				key: 'prof_interests',
				params: { cats: p.interests }
			});
			for (const c of p.interests) bump(c as Cat, 0.6);
		}
		if (p.pace)
			lines.push({ id: 'quiz:pace', source: 'quiz', key: 'prof_pace', params: { pace: p.pace } });
		if (p.diet)
			lines.push({ id: 'quiz:diet', source: 'quiz', key: 'prof_diet', params: { diet: p.diet } });
		if (p.seafood != null)
			lines.push({
				id: 'quiz:seafood',
				source: 'quiz',
				key: p.seafood ? 'prof_seafood_yes' : 'prof_seafood_no'
			});
		if (p.group_type)
			lines.push({
				id: 'quiz:group',
				source: 'quiz',
				key: 'prof_group',
				params: { group: p.group_type }
			});
	}

	if (p.use_activity) {
		const since = new Date(Date.now() - 90 * DAY).toISOString();
		const [{ data: act }, { data: saved }] = await Promise.all([
			db
				.from('user_activity')
				.select('kind, entity_type, entity_id, query')
				.eq('user_id', userId)
				.gte('at', since)
				.limit(500),
			db
				.from('saved_items')
				.select('entity_type, entity_id')
				.eq('user_id', userId)
				.eq('entity_type', 'place')
		]);
		const ids = [
			...(act ?? [])
				.filter((a) => a.entity_type === 'place' && a.entity_id)
				.map((a) => a.entity_id!),
			...(saved ?? []).map((s) => s.entity_id)
		];
		const of = await placeCats(db, ids);
		const counts = new Map<Cat, number>();
		for (const id of ids) {
			const c = of.get(id);
			if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
		}
		for (const a of act ?? [])
			for (const c of CATS)
				if (a.query?.toLowerCase().includes(c)) counts.set(c, (counts.get(c) ?? 0) + 1);
		const often = top(counts, 3);
		if (often.length)
			lines.push({
				id: 'activity:often',
				source: 'activity',
				key: 'prof_often',
				params: { cats: often }
			});
		for (const [c, n] of counts) bump(c, Math.min(0.3, n * 0.05));
	}

	if (p.use_trips) {
		const since = new Date(Date.now() - 365 * DAY).toISOString();
		const { data: joined } = await db.from('trip_members').select('trip_id').eq('user_id', userId);
		const { data: trips } = await db
			.from('trips')
			.select('id, trip_stops(entity_type, entity_id)')
			.or([`owner_id.eq.${userId}`, ...(joined ?? []).map((j) => `id.eq.${j.trip_id}`)].join(','))
			.gte('created_at', since)
			.limit(30);
		const { data: visits } = await db
			.from('verified_visits')
			.select('entity_type, entity_id')
			.eq('user_id', userId)
			.eq('entity_type', 'place')
			.gte('created_at', since);
		const ids = [
			...(trips ?? []).flatMap((t) =>
				t.trip_stops.filter((s) => s.entity_type === 'place').map((s) => s.entity_id)
			),
			...(visits ?? []).map((v) => v.entity_id)
		];
		const of = await placeCats(db, ids);
		const counts = new Map<Cat, number>();
		for (const id of ids) {
			const c = of.get(id);
			if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
		}
		if (trips?.length)
			lines.push({
				id: 'trips:summary',
				source: 'trips',
				key: 'prof_trips',
				params: { n: trips.length, cats: top(counts, 2) }
			});
		for (const [c, n] of counts) bump(c, Math.min(0.4, n * 0.1));
	}

	// Chat-extracted and user-written lines stay (their sources' toggles delete them — DB trigger).
	const kept = old.filter((l) => l.source === 'chat' || l.source === 'user');
	const next = [
		...lines.map((l) => (hidden.has(l.id) ? { ...l, hidden: true } : l)),
		...kept
	].slice(0, 30);
	const { data, error } = await db
		.from('user_profile')
		.update({ lines: next as never, scores: { interests: Object.fromEntries(score) } as never })
		.eq('user_id', userId)
		.select('*')
		.single();
	if (error) throw error;
	return data;
}

/** What the LLM gets: the visible lines in English plus the persona, ≤ 8 lines. Never raw data. */
export function profileSummary(p: Profile | null): string {
	if (!p) return 'none';
	const lines = ((p.lines as Line[]) ?? []).filter((l) => !l.hidden).slice(0, 8);
	return lines.length ? lines.map((l) => `- ${lineText(l, 'en')}`).join('\n') : 'none';
}

/** Planner defaults (product plan 10.7 "profile feeds planner defaults"), only from the quiz the user filled. */
export function plannerDefaults(p: Profile | null) {
	const quiz = p?.use_quiz ? p : null;
	return {
		interests: (quiz?.interests ?? []) as Cat[],
		pace: quiz?.pace ?? null,
		group_type: quiz?.group_type ?? null,
		diet: quiz?.diet ?? null,
		mileage: quiz?.mileage_kmpl != null ? Number(quiz.mileage_kmpl) : null
	};
}

// Chats → stated preferences only (use_chats on). Cheap cue check first so most turns cost nothing.
const CUE =
	/\b(i am|i'm|we are|we're|i prefer|we prefer|i like|we like|we love|i love|i don't|we don't|allergic|vegetarian|veg|jain|seafood)\b|मैं |हम |मुझे |हमें |मला |आम्ही |आवडत/i;
const EXTRACT = `From the traveller's message, list travel preferences they state about themselves or their group
(food, diet, pace, budget, interests, who travels, how they travel). Ignore anything else. Never include names, phone
numbers, addresses, health conditions other than diet, or places they live. Reply ONLY with JSON {"lines": ["…"]},
at most 3 short lines (≤ 80 characters) in the message's language; {"lines": []} if none.`;

export async function learnFromChat(db: DB, userId: string, p: Profile | null, message: string) {
	if (!p?.use_chats || !CUE.test(message)) return;
	const { error: cap } = await db.rpc('ai_take', { _feature: 'profile' });
	if (cap) return;
	const msgs: Msg[] = [
		{ role: 'system', content: EXTRACT },
		{ role: 'user', content: message.slice(0, 500) }
	];
	const r = await route(chain('intent'), { messages: msgs, json: true, maxTokens: 150 }).catch(
		() => null
	);
	let found: string[];
	try {
		found = ((JSON.parse(r?.content ?? '{}') as { lines?: unknown }).lines ?? []) as string[];
	} catch {
		return;
	}
	const clean = found
		.filter((x) => typeof x === 'string' && x.trim())
		.map((x) => x.trim().slice(0, 80))
		.slice(0, 3);
	if (!clean.length) return;
	const lines = (p.lines as Line[]) ?? [];
	const have = new Set(lines.map((l) => l.text?.toLowerCase()));
	const add = clean
		.filter((t) => !have.has(t.toLowerCase()))
		.map((text): Line => ({
			id: `chat:${crypto.randomUUID().slice(0, 8)}`,
			source: 'chat',
			text
		}));
	if (!add.length) return;
	const chat = [...lines.filter((l) => l.source === 'chat'), ...add].slice(-10);
	await db
		.from('user_profile')
		.update({ lines: [...lines.filter((l) => l.source !== 'chat'), ...chat] as never })
		.eq('user_id', userId);
}
