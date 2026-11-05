// YAML shapes of the desk research in data/ (DATA_REQUIREMENTS §4.4) and the import checks of §4.5. Categories and
// talukas come from the database (region data, never hard-coded), so the place/eatery/event schemas are built per run.
// Keys not listed are refused (strict objects); keys starting with `_` and source keys with no column (OSM ids,
// google_place_id, …) are audit metadata, kept in import_audit.
import { z } from 'zod';

export const DAYS = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 } as const;
export const PLACE_TEXT = ['short_story', 'history', 'significance', 'dos', 'donts', 'safety_text'] as const;
export const LANGS = ['en', 'mr', 'hi'] as const;
export const LICENCES = ['CC BY 4.0', 'CC BY-SA 4.0', 'CC BY 3.0', 'CC BY-SA 3.0', 'CC BY 2.5', 'CC BY-SA 2.5', 'CC BY 2.0', 'CC BY-SA 2.0'];

export type Ctx = { categories: string[]; talukas: Map<string, string> };

const text = (max: number) =>
	z
		.string()
		.max(max)
		.nullable()
		.transform((s) => (s?.trim() ? s : null));
const https = z.url({ protocol: /^https$/ });
const time = z
	.string()
	.regex(/^\d{2}:\d{2}$/, 'HH:MM')
	.nullable();
const int = (min: number, max: number) => z.number().int().min(min).max(max).nullable();
const phone = z
	.string()
	.regex(/^\+?[\d\s-]{6,20}$/, 'phone like +91 …')
	.nullable();
const days = z.array(z.enum(Object.keys(DAYS) as [keyof typeof DAYS])).default([]);
const coord = (min: number, max: number) => z.number().min(min).max(max).nullable();
const sources = z.record(z.string(), z.array(https)).default({});
const meta = { _sources: sources, _review: z.string().nullable().optional(), _collected_by: z.string().nullable().optional() };
const taluka = (ctx: Ctx) =>
	z
		.string()
		.transform((t) => ctx.talukas.get(t.toLowerCase()) ?? '')
		.refine(Boolean, 'unknown taluka');
const tri = <T extends string, V extends z.ZodType>(keys: readonly T[], v: V) =>
	z.strictObject(Object.fromEntries(keys.map((k) => [k, v])) as { [K in T]: V });
const both = (r: { opens: string | null; closes: string | null }) => (r.opens == null) === (r.closes == null);

export function placeSchema(ctx: Ctx) {
	return z
		.strictObject({
			slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase words joined by -').max(60),
			status: z.literal('ai_draft'),
			name_en: z.string().min(2).max(120),
			name_mr: text(120),
			name_hi: text(120),
			category: z.string().refine((c) => ctx.categories.includes(c), 'unknown category'),
			taluka: taluka(ctx),
			lat: coord(-90, 90),
			lng: coord(-180, 180),
			coord_source: z.string().nullable(),
			osm_id: z.string().nullable(),
			entry_fee_text: text(1000),
			entry_fee_inr: int(0, 100_000),
			visit_minutes: int(10, 600),
			opens: time,
			closes: time,
			closed_days: days,
			best_time: text(1000),
			how_to_reach: text(1000),
			nearest_station: text(1000),
			nearest_bus_stop: text(1000),
			monsoon_status: z.enum(['open', 'risky', 'closed']),
			monsoon_reason: text(1000),
			is_tide_dependent: z.boolean(),
			// Seasons are imported from seasonal/place_seasonal.yaml (the same rows); checked equal by the runner.
			seasons: z.array(z.unknown()),
			wikipedia_url: https.nullable(),
			is_hidden_gem: z.literal(false, 'verifier only (BACKEND §3.3, Q8)'),
			text: tri(LANGS, tri(PLACE_TEXT, text(5000))),
			// Photos come from photos/manifest.yaml.
			photo: z.unknown(),
			...meta
		})
		.refine(both, { path: ['closes'], message: 'give both opens and closes, or neither' })
		.refine((r) => (r.lat == null) === (r.lng == null), { path: ['lng'], message: 'give both lat and lng, or neither' })
		.refine((r) => r.monsoon_status === 'open' || r.monsoon_reason, {
			path: ['monsoon_reason'],
			message: 'required when monsoon_status is not open'
		})
		.refine((r) => sourceUrls(r._sources).length >= 1, { path: ['_sources'], message: 'needs 1–10 https sources' })
		.refine((r) => sourceUrls(r._sources).length <= 10, { path: ['_sources'], message: 'needs 1–10 https sources' });
}

export function eaterySchema(ctx: Ctx, dishSlugs: Set<string>) {
	const app = z.strictObject({ available: z.boolean().nullable(), link: https.nullable() });
	return z
		.strictObject({
			slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase words joined by -').max(60),
			status: z.literal('ai_draft'),
			name_en: z.string().min(2).max(120),
			name_mr: text(120),
			name_hi: text(120),
			taluka: taluka(ctx),
			area: z.string().nullable(),
			lat: coord(-90, 90),
			lng: coord(-180, 180),
			google_place_id: z.string().nullable(),
			authenticity: z.enum(['home_style', 'local_legend', 'tourist_oriented']).nullable(),
			price_for_two: int(0, 100_000),
			diet_flags: tri(['veg', 'non_veg', 'jain'], z.boolean().nullable()),
			opens: time,
			closes: time,
			closed_days: days,
			food_apps: tri(['swiggy', 'zomato', 'eatsure', 'magicpin'], app),
			menu: z.strictObject({ items: z.array(z.string().min(1).max(200)) }),
			dishes: z
				.array(
					z.strictObject({
						slug: z.string().refine((s) => dishSlugs.has(s), 'dish slug not in dishes.yaml'),
						is_signature: z.boolean(),
						is_best_for: z.boolean()
					})
				)
				.max(10),
			phone,
			whatsapp: phone,
			description: tri(LANGS, text(5000)),
			...meta
		})
		.refine(both, { path: ['closes'], message: 'give both opens and closes, or neither' })
		.refine((r) => (r.lat == null) === (r.lng == null), { path: ['lng'], message: 'give both lat and lng, or neither' });
}

export const VIBES = [
	'traditional_konkani_home', 'family', 'luxury', 'business', 'backpacker', 'couple_friendly', 'pet_friendly',
	'beachfront', 'orchard_stay'
] as const;

export function staySchema(ctx: Ctx) {
	return z
		.strictObject({
			slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase words joined by -').max(60),
			status: z.literal('ai_draft'),
			name_en: z.string().min(2).max(120),
			name_mr: text(120),
			name_hi: text(120),
			taluka: taluka(ctx),
			area: z.string().nullable(),
			lat: coord(-90, 90),
			lng: coord(-180, 180),
			google_place_id: z.string().nullable(),
			service_style: z.enum(['homely', 'professional']).nullable(),
			vibe_tags: z.array(z.enum(VIBES)).default([]),
			food_at_stay: tri(['veg', 'non_veg', 'malvani', 'jain', 'homemade_included'], z.boolean().nullable()),
			price_min: int(0, 1_000_000),
			price_max: int(0, 1_000_000),
			price_source: z.enum(['owner', 'agoda', 'affiliate', 'listed_online']).nullable(),
			price_url: https.nullable(),
			phone,
			whatsapp: phone,
			official_url: https.nullable(),
			description: tri(LANGS, text(5000)),
			// Plain OTA pages (Q12): stay_offers without an affiliate network until those accounts exist.
			// Provider ids as in §4.4 (`Booking.com` → `booking_com`).
			ota_links: z.array(
				z.strictObject({
					provider: z
						.string()
						.transform((s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''))
						.pipe(z.string().regex(/^[a-z0-9_]+$/, 'provider id')),
					url: https
				})
			),
			...meta
		})
		.refine((r) => (r.lat == null) === (r.lng == null), { path: ['lng'], message: 'give both lat and lng, or neither' })
		.refine((r) => r.price_min == null || r.price_max == null || r.price_max >= r.price_min, {
			path: ['price_max'],
			message: 'below price_min'
		});
}

export const dishSchema = z.strictObject({
	slug: z.string().regex(/^[a-z][a-z0-9_-]{1,40}$/, 'dish slug'),
	status: z.literal('ai_draft'),
	name: z.strictObject({ en: z.string().min(2).max(120), mr: text(120), hi: text(120) }),
	what_it_is: tri(LANGS, text(1000)),
	story: tri(LANGS, text(5000)),
	photo: z.strictObject({ file_url: z.null(), credit: z.null(), licence: z.null(), source_url: z.null() }),
	...meta
});

export function eventSchema(ctx: Ctx) {
	return z
		.strictObject({
			status: z.literal('ai_draft'),
			name: z.strictObject({ en: z.string().min(1).max(120), mr: text(120), hi: text(120) }),
			type: z.enum(['festival', 'jatra', 'season']),
			from_date: z.iso.date(),
			to_date: z.iso.date(),
			taluka: taluka(ctx).nullable(),
			impact: z.strictObject({ crowd: z.enum(['busy', 'calm']).nullable(), closures: text(300) }),
			...meta
		})
		.refine((r) => r.to_date >= r.from_date, { path: ['to_date'], message: 'before from_date' });
}

export const seasonalSchema = z.strictObject({
	place: z.string(),
	season: z.enum(['turtle_nesting', 'mango', 'firefly', 'waterfall']),
	from_month: z.number().int().min(1).max(12),
	to_month: z.number().int().min(1).max(12),
	status: z.literal('ai_draft')
});

export const photoSchema = z.strictObject({
	slug: z.string(),
	taluka: z.string(),
	file_url: https,
	credit: z.string().min(1).max(200),
	licence: z.string().refine((l) => LICENCES.includes(l), 'licence must be CC BY or CC BY-SA 2.0–4.0'),
	source_url: https.max(500),
	is_hero: z.boolean(),
	note: z.string().nullable()
});

export const utilitySchema = z.strictObject({
	osm_id: z
		.string()
		.regex(/^(node|way)\/\d+$/, 'node/<id> or way/<id>')
		.nullable(),
	type: z.enum(['hospital', 'police']),
	taluka: z.string(),
	name: z.string().min(1),
	phone,
	emergency_24h: z.boolean().nullable().optional(),
	emergency_24h_maps_hint: z.unknown().optional(),
	is_real_hospital: z.boolean().nullable().optional(),
	google_place_id: z.string().nullable().optional(),
	status: z.literal('ai_draft'),
	...meta
});

/** All https sources of a row, de-duplicated, in file order (→ places.source_urls). */
export function sourceUrls(s: Record<string, string[]>) {
	return [...new Set(Object.values(s).flat())];
}

/** OSM "way/123" → the stored id (ways negative, nodes positive: pipelines/utility-pois). */
export const osmKey = (id: string) => (id.startsWith('way/') ? -1 : 1) * Number(id.split('/')[1]);

/** place_hours / eatery_hours rows: one pair for every day except the closed days; none without times (M6). */
export function hoursOf(r: { opens: string | null; closes: string | null; closed_days: (keyof typeof DAYS)[] }) {
	if (r.opens == null) return [];
	const closed = r.closed_days.map((d) => DAYS[d]) as number[];
	return [0, 1, 2, 3, 4, 5, 6].map((weekday) =>
		closed.includes(weekday) ? { weekday, opens: null, closes: null } : { weekday, opens: r.opens, closes: r.closes }
	);
}

/** Soft checks (§4.5 "New"): reported and flagged for review, not refused. */
const DEVANAGARI = /[ऀ-ॿ]/;
const PHONE_IN_TEXT = /(\+?\d[\d\s-]{8,}\d)|[\w.+-]+@[\w-]+\.[\w.]+/;
export function softChecks(row: { mr: (string | null)[]; hi: (string | null)[]; long: (string | null)[] }) {
	const out: string[] = [];
	if (row.mr.some((s) => s && !DEVANAGARI.test(s))) out.push('Marathi text without Devanagari');
	if (row.hi.some((s) => s && !DEVANAGARI.test(s))) out.push('Hindi text without Devanagari');
	if (row.long.some((s) => s && PHONE_IN_TEXT.test(s))) out.push('phone number or email inside long text');
	return out;
}

/** Rows a human must see first: low-trust batch rows and explicit CHECK notes in `_review`. */
export const flagOf = (review: string | null | undefined) =>
	/LOW TRUST/.test(review ?? '') ? 'LOW TRUST' : /\bCHECK\b/.test(review ?? '') ? 'CHECK' : null;

/** A readable reason from a Zod error: "taluka: unknown taluka; lat: …". */
export const reason = (e: z.ZodError) => e.issues.map((i) => `${i.path.join('.') || 'row'}: ${i.message}`).join('; ');
