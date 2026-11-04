// Snap and ask (P12 step K, product plan 10.5; P12-4): a photo of a fort, temple, idol, dish or fish → a Groq vision
// model describes it → we match the description to OUR places and dishes (by name, or by kind near the traveller)
// → name, short story and our page. No confident match → "Not sure" + Ask our team, and the description (never the
// photo) is kept as a lead for the content team. EXIF/GPS is stripped on the phone; the traveller's location never
// goes to the model — it only ranks our own candidates.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/db.types.ts';
import { lonLat, tr, type Lang } from '../listings.ts';
import { chain, route } from './router.ts';

type DB = SupabaseClient<Database>;
export type SnapResult =
	| {
			kind: 'match';
			type: 'place' | 'dish';
			slug: string;
			name: string;
			story: string | null;
			href: string;
	  }
	| { kind: 'unsure'; description: string };

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
];
const PROMPT = `You look at a traveller's photo from the Konkan coast (India) so it can be matched to a travel
database. Describe only what you see. Reply ONLY with JSON:
{"kind": "place" | "dish" | "fish" | "other", "name_guess": string | null (a name only if written in the photo or
unmistakable), "category": one of ${CATS.join(', ')} or null, "keywords": [up to 6 short words], "text_seen": string | null}`;

const km = (a: { lon: number; lat: number }, b: [number, number]) =>
	Math.hypot((a.lon - b[0]) * 111.32 * Math.cos((a.lat * Math.PI) / 180), (a.lat - b[1]) * 110.57);

export async function snapAsk(
	db: DB,
	lang: Lang,
	image: string,
	caption: string,
	near: { lon: number; lat: number } | null
): Promise<SnapResult> {
	const r = await route(chain('vision'), {
		messages: [
			{ role: 'system', content: PROMPT },
			{ role: 'user', content: caption.slice(0, 300) || 'What is this?', images: [image] }
		],
		json: true,
		maxTokens: 300
	});
	let d: {
		kind?: string;
		name_guess?: string | null;
		category?: string | null;
		keywords?: string[];
		text_seen?: string | null;
	} = {};
	try {
		d = JSON.parse(r.content);
	} catch {
		/* unreadable answer → unsure */
	}
	const words = [d.name_guess, d.text_seen, ...(d.keywords ?? [])].filter(
		(w): w is string => !!w?.trim()
	);
	const description = words.join(', ').slice(0, 300) || 'unknown';
	const clean = (s: string) =>
		s
			.replace(/[%_,()]/g, ' ')
			.trim()
			.slice(0, 60);

	if (d.kind === 'dish' || d.kind === 'fish') {
		for (const w of words.filter((w) => w.length > 2)) {
			const { data } = await db
				.from('dish_translations')
				.select('name, what_it_is, lang, dishes!inner(slug)')
				.ilike('name', `%${clean(w)}%`)
				.limit(1)
				.maybeSingle();
			if (data) {
				const slug = (data as unknown as { dishes: { slug: string } }).dishes.slug;
				return {
					kind: 'match',
					type: 'dish',
					slug,
					name: data.name,
					story: data.what_it_is,
					href: `/taste-konkan/${slug}`
				};
			}
		}
	}
	if (d.kind === 'place') {
		// By a name seen in (or unmistakable from) the photo…
		if (d.name_guess) {
			const { data } = await db
				.from('place_translations')
				.select('name, short_story, places!inner(slug, status)')
				.ilike('name', `%${clean(d.name_guess)}%`)
				.eq('places.status', 'published')
				.limit(1)
				.maybeSingle();
			if (data) {
				const slug = (data as unknown as { places: { slug: string } }).places.slug;
				return {
					kind: 'match',
					type: 'place',
					slug,
					name: data.name,
					story: data.short_story,
					href: `/place/${slug}`
				};
			}
		}
		// …or by kind, when exactly one of ours is right where the traveller is.
		if (near && d.category && CATS.includes(d.category)) {
			const { data } = await db
				.from('places')
				.select('slug, location, place_translations(lang, name, short_story)')
				.eq('status', 'published')
				.eq('category', d.category as never)
				.limit(300);
			const close = (data ?? [])
				.map((p) => ({ p, c: lonLat(p.location) }))
				.filter((x): x is { p: typeof x.p; c: [number, number] } => !!x.c && km(near, x.c) <= 2);
			if (close.length === 1) {
				const p = close[0]!.p;
				const t = p.place_translations.find((x) => x.lang === lang) ?? p.place_translations[0];
				return {
					kind: 'match',
					type: 'place',
					slug: p.slug,
					name: tr(p.place_translations, lang) ?? p.slug,
					story: t?.short_story ?? null,
					href: `/place/${p.slug}`
				};
			}
		}
	}
	// Not in our list yet: a lead for the content team (the description only, never the photo).
	await db.from('ai_leads').insert({ kind: 'photo', input: description });
	return { kind: 'unsure', description };
}
