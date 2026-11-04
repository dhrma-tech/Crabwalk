// Trip journal (P12 step M, product plan 10.10). Auto-filled from the trip (stops by day, which ones the user
// checked in at, what the group spent); the user answers a short interview per stop; Crabby writes the story ONLY
// from those answers and these facts. Private by default; a share link only when the user turns it on.
// Photos and clips stay on the phone; only photos the user shares are uploaded (compressed, ≤ 20 per user).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/db.types.ts';
import type { Lang } from './listings.ts';
import { describeStops } from './planner/trips.ts';
import type { Msg } from './ai/providers.ts';
import { chain, route } from './ai/router.ts';
import { personaRules } from './ai/persona.ts';

type DB = SupabaseClient<Database>;
export type JournalStop = {
	/** Interview answer key: the stop's id. */
	key: string;
	day: number;
	type: 'place' | 'stay' | 'eatery';
	name: string;
	href: string;
	/** Checked in there (QR + GPS or booking proof): only then can the user vote on it. */
	visited: boolean;
};
export type JournalData = {
	title: string;
	startDate: string | null;
	days: number;
	stops: JournalStop[];
	spent: number;
};
/** Interview answers: one per stop key, plus the whole trip. */
export type Answers = Record<string, string>;

const LANG_NAME: Record<Lang, string> = { en: 'English', hi: 'Hindi', mr: 'Marathi' };

export async function journalData(
	db: DB,
	tripId: string,
	userId: string,
	lang: Lang
): Promise<JournalData | null> {
	const { data: t } = await db
		.from('trips')
		.select('title, start_date, days, trip_stops(id, day, "order", entity_type, entity_id)')
		.eq('id', tripId)
		.maybeSingle();
	if (!t) return null;
	const stops = [...t.trip_stops].sort((a, b) => a.day - b.day || a.order - b.order);
	const [names, { data: visits }, { data: spent }] = await Promise.all([
		describeStops(db, stops, lang),
		db
			.from('verified_visits')
			.select('entity_id')
			.eq('user_id', userId)
			.in(
				'entity_id',
				stops.map((s) => s.entity_id)
			),
		db.from('trip_expenses').select('amount').eq('trip_id', tripId)
	]);
	const seen = new Set((visits ?? []).map((v) => v.entity_id));
	return {
		title: t.title,
		startDate: t.start_date,
		days: t.days,
		stops: stops.flatMap((s) => {
			const n = names.get(s.entity_id);
			return n
				? [
						{
							key: s.id,
							day: s.day,
							type: s.entity_type,
							name: n.name,
							href: n.href,
							visited: seen.has(s.entity_id)
						}
					]
				: [];
		}),
		spent: (spent ?? []).reduce((a, e) => a + Number(e.amount), 0)
	};
}

/** The story, from the user's answers and the trip's facts only (cap: ai_take('journal')). Null = cap or AI down. */
export async function writeStory(
	db: DB,
	d: JournalData,
	answers: Answers,
	lang: Lang,
	persona: 'playful' | 'plain'
): Promise<string | null> {
	const { error } = await db.rpc('ai_take', { _feature: 'journal' });
	if (error) return null;
	const facts = {
		trip: d.title,
		days: d.days,
		stops: d.stops.map((s) => ({ day: s.day, name: s.name, said: answers[s.key]?.trim() || null })),
		whole_trip: answers.trip?.trim() || null
	};
	const messages: Msg[] = [
		{
			role: 'system',
			content: `Write the traveller's trip story in ${LANG_NAME[lang]}, first person, 120–250 words, day by day.
Use ONLY the facts and the traveller's own words given ("said"). Never add places, events, weather, food, prices,
people or feelings they did not give; a stop with nothing said gets at most a short mention. No phone numbers.
${personaRules(persona, lang)}`
		},
		{ role: 'user', content: JSON.stringify(facts).slice(0, 8000) }
	];
	const res = await route(chain('explain'), { messages, maxTokens: 700 }).catch(() => null);
	return res?.content.trim().slice(0, 12000) || null;
}
