// Reel to trip (P12 step L, product plan 10.6): a YouTube link, a pasted caption or a screenshot → the places it
// shows, matched to OUR list → a reality-check card built only from our data (open today, monsoon, safety, verdict,
// best time) → "Add to trip" (a confirm-first action). Nothing matched → "Not in our list yet" + Ask our team, and the
// input is kept as a lead for the content team. Instagram can't be read without Meta review (plan §8): the user is
// asked for the caption or a screenshot instead. No scraping: YouTube's public oEmbed gives the title only.
import type { SupabaseClient } from '@supabase/supabase-js';
import { AI_PROVIDER } from '$app/env/private';
import type { Database } from '#lib/db.types.ts';
import { msg } from '#lib/msg.ts';
import { tr, type Lang } from '../listings.ts';
import { chain, route } from './router.ts';

type DB = SupabaseClient<Database>;
export type RealityCheck = {
	slug: string;
	name: string;
	href: string;
	/** Today's hours: "09:00–18:00", "closed", or null when we don't know. */
	hours: string | null;
	monsoon: 'open' | 'risky' | 'closed';
	monsoon_reason: string | null;
	safety: string | null;
	verdict: string | null;
	best_time: string | null;
	tide: boolean;
};
export type ReelResult =
	| { kind: 'found'; source: string | null; places: RealityCheck[]; action: ReelAction | null }
	| { kind: 'none'; source: string | null; what: string }
	| { kind: 'need_caption' };
/** One confirm-first "add these to my trip" (ai_actions add_to_list), or none when the user has no trip yet. */
export type ReelAction = {
	id: string;
	type: 'add_to_list';
	preview: { title: string; lines: string[] };
};

const YT =
	/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?\S*v=|shorts\/)|youtu\.be\/)[\w-]{6,}/i;
const IG = /^https?:\/\/(?:www\.)?instagram\.com\//i;
export const isReelUrl = (u: string) => YT.test(u) || IG.test(u);

/** The video's title from YouTube's public oEmbed (no key, no scraping). Tests (mock AI) read the id as the title. */
async function youtubeTitle(url: string): Promise<string | null> {
	if (AI_PROVIDER === 'mock') {
		const id = /(?:v=|shorts\/|youtu\.be\/)([\w-]+)/.exec(url)?.[1] ?? '';
		return id.replace(/[-_]/g, ' ');
	}
	const r = await fetch(
		`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
		{ signal: AbortSignal.timeout(5000) }
	).catch(() => null);
	if (!r?.ok) return null;
	const j = (await r.json().catch(() => null)) as { title?: string } | null;
	return j?.title?.slice(0, 300) ?? null;
}

const norm = (s: string) =>
	` ${s
		.toLowerCase()
		.normalize('NFKC')
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim()} `;

const today = () => new Date(Date.now() + 5.5 * 3600e3).getUTCDay();

/** Places whose name (any language) or slug appears in the text — code only, so nothing is invented. */
async function matchByName(db: DB, text: string, extra: string[]) {
	const { data } = await db
		.from('places')
		.select('id, slug, place_translations(name)')
		.eq('status', 'published')
		.limit(2000);
	const hay = norm(text);
	const wanted = extra.map(norm);
	return (data ?? [])
		.filter((p) => {
			const keys = [p.slug.replace(/-/g, ' '), ...p.place_translations.map((t) => t.name)]
				.map(norm)
				.filter((k) => k.trim().length >= 4);
			return keys.some((k) => hay.includes(k) || wanted.some((w) => w === k || w.includes(k)));
		})
		.map((p) => p.id)
		.slice(0, 3);
}

/** Place names a model reads from the text (other scripts, spelling) — only used to look up OUR list. */
async function namesFromModel(text: string): Promise<string[]> {
	const r = await route(chain('intent'), {
		messages: [
			{
				role: 'system',
				content:
					'From a travel reel title/caption (any language), list the specific named places in the Konkan region (India) it shows, in English spelling. Reply ONLY with JSON: {"places": [up to 5 names]}. No guesses: [] if none are named.'
			},
			{ role: 'user', content: text.slice(0, 1500) }
		],
		json: true,
		maxTokens: 150
	}).catch(() => null);
	try {
		const p = (JSON.parse(r?.content ?? '{}') as { places?: unknown }).places;
		return Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string').slice(0, 5) : [];
	} catch {
		return [];
	}
}

/** What a screenshot shows: names / text seen (P12-4: vision on Groq; the photo is not stored). */
async function wordsFromImage(image: string): Promise<string> {
	const r = await route(chain('vision'), {
		messages: [
			{
				role: 'system',
				content:
					'This is a screenshot of a travel reel from the Konkan coast (India). Reply ONLY with JSON: {"name_guess": string | null (a place name only if written or unmistakable), "text_seen": string | null}'
			},
			{ role: 'user', content: 'Which place is this?', images: [image] }
		],
		json: true,
		maxTokens: 200
	});
	try {
		const d = JSON.parse(r.content) as { name_guess?: string | null; text_seen?: string | null };
		return [d.name_guess, d.text_seen].filter(Boolean).join(' · ').slice(0, 300);
	} catch {
		return '';
	}
}

async function realityChecks(db: DB, ids: string[], lang: Lang): Promise<RealityCheck[]> {
	const [{ data: places }, { data: votes }] = await Promise.all([
		db
			.from('places')
			.select(
				'id, slug, best_time_text, monsoon_status, monsoon_reason, is_tide_dependent, place_translations(lang, name, safety_text), place_hours(weekday, opens, closes, hours_unknown)'
			)
			.in('id', ids),
		db
			.from('verdict_agg_all')
			.select('entity_id, winner_level, winner_pct, total')
			.eq('entity_type', 'place')
			.in('entity_id', ids)
	]);
	return ids.flatMap((id) => {
		const p = places?.find((x) => x.id === id);
		if (!p) return [];
		const v = votes?.find((x) => x.entity_id === id);
		const h = p.place_hours.find((x) => x.weekday === today());
		return [
			{
				slug: p.slug,
				name: tr(p.place_translations, lang) ?? p.slug,
				href: `/place/${p.slug}`,
				hours:
					!h || h.hours_unknown
						? null
						: !h.opens || !h.closes
							? 'closed'
							: `${h.opens.slice(0, 5)}–${h.closes.slice(0, 5)}`,
				monsoon: p.monsoon_status,
				monsoon_reason: p.monsoon_reason,
				safety: tr(p.place_translations, lang, 'safety_text') ?? null,
				// A verdict only once enough people voted (same rule as the cards).
				verdict:
					v?.winner_level && (v.total ?? 0) >= 10
						? `${msg(`verdict_place_${v.winner_level}`, {}, lang)} · ${Math.round((v.winner_pct ?? 0) * 100)}%`
						: null,
				best_time: p.best_time_text,
				tide: p.is_tide_dependent
			}
		];
	});
}

/** Reel → our places → reality checks + one "Add to trip" proposal for the user's latest trip. */
export async function reelToTrip(
	db: DB,
	userId: string,
	lang: Lang,
	input: { url: string | null; caption: string; image: string | null }
): Promise<ReelResult> {
	if (input.url && IG.test(input.url) && !input.caption && !input.image)
		return { kind: 'need_caption' };
	const title = input.url && YT.test(input.url) ? await youtubeTitle(input.url) : null;
	const seen = input.image ? await wordsFromImage(input.image) : '';
	const text = [title, input.caption, seen].filter(Boolean).join('\n');
	let ids = text ? await matchByName(db, text, []) : [];
	if (!ids.length && text) {
		const names = await namesFromModel(text);
		if (names.length) ids = await matchByName(db, '', names);
	}
	if (!ids.length) {
		const what = (title ?? (input.caption || seen || input.url) ?? '').slice(0, 200);
		await db
			.from('ai_leads')
			.insert({ kind: 'reel', input: text.slice(0, 1000) || '—', url: input.url });
		return { kind: 'none', source: title, what };
	}
	const places = await realityChecks(db, ids, lang);
	// The trip the user touched last; they see its name before anything is added.
	const { data: trip } = await db
		.from('trips')
		.select('id, title')
		.eq('owner_id', userId)
		.eq('is_ready_made', false)
		.order('updated_at', { ascending: false, nullsFirst: false })
		.limit(1)
		.maybeSingle();
	let action: ReelAction | null = null;
	if (trip && places.length) {
		const preview = {
			title: msg('reel_add_title', { trip: trip.title }, lang),
			lines: places.map((p) => p.name)
		};
		const { data: row } = await db
			.from('ai_actions')
			.insert({
				user_id: userId,
				type: 'add_to_list',
				preview: {
					...preview,
					payload: {
						trip_id: trip.id,
						place_ids: ids,
						list_title: msg('plan_places', {}, lang)
					}
				} as never
			})
			.select('id')
			.single();
		if (row) action = { id: row.id, type: 'add_to_list', preview };
	}
	return { kind: 'found', source: title, places, action };
}
