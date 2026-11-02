// One CSV row = one place researched at the desk (DECISIONS T-6 / T-50, Report 1 §1.4). Categories and talukas come
// from the database (region data, never hard-coded), so the schema is built per run.
import { z } from 'zod';

export const COLUMNS = [
	'slug', 'name_en', 'name_mr', 'category', 'taluka', 'lat', 'lng',
	'entry_fee_text', 'entry_fee_inr', 'visit_minutes', 'opens', 'closes', 'closed_days',
	'best_time', 'how_to_reach', 'nearest_station', 'nearest_bus_stop',
	'monsoon_status', 'monsoon_reason', 'is_tide_dependent', 'is_hidden_gem',
	'short_story', 'history', 'significance', 'dos', 'donts', 'safety_text', 'source_urls'
] as const;

/** Long English text goes to content_drafts for a reviewer; these are the place review fields. */
export const DRAFT_FIELDS = ['short_story', 'history', 'significance', 'dos', 'donts', 'safety_text'] as const;

const DAYS = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 } as const;
const opt = (max: number) =>
	z
		.string()
		.max(max)
		.transform((s) => s || null);
const int = (min: number, max: number) =>
	z
		.string()
		.regex(/^\d*$/, 'whole number')
		.transform((s) => (s === '' ? null : Number(s)))
		.pipe(z.number().int().min(min).max(max).nullable());
const yesNo = z
	.string()
	.toLowerCase()
	.refine((s) => ['', 'yes', 'no', 'true', 'false', '1', '0', 'y', 'n'].includes(s), 'yes or no')
	.transform((s) => ['yes', 'true', '1', 'y'].includes(s));
const time = z
	.string()
	.regex(/^(\d{1,2}:\d{2})?$/, 'HH:MM')
	.transform((s) => (s ? s.padStart(5, '0') : null));

export function rowSchema(ctx: { categories: string[]; talukas: Map<string, string> }) {
	return z
		.object({
			slug: z
				.string()
				.regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase words joined by -')
				.max(60),
			name_en: z.string().min(2).max(120),
			name_mr: opt(120),
			category: z.string().refine((c) => ctx.categories.includes(c), 'unknown category'),
			taluka: z
				.string()
				.transform((t) => ctx.talukas.get(t.toLowerCase()) ?? '')
				.refine(Boolean, 'unknown taluka'),
			lat: z.string().min(1, 'required').transform(Number).pipe(z.number().min(-90).max(90)),
			lng: z.string().min(1, 'required').transform(Number).pipe(z.number().min(-180).max(180)),
			entry_fee_text: opt(1000),
			entry_fee_inr: int(0, 100_000),
			visit_minutes: int(10, 600),
			opens: time,
			closes: time,
			closed_days: z
				.string()
				.toLowerCase()
				.transform((s) => s.split(/[\s,;]+/).filter(Boolean))
				.refine((d) => d.every((x) => x in DAYS), 'days as mon, tue, …')
				.transform((d) => d.map((x) => DAYS[x as keyof typeof DAYS])),
			best_time: opt(1000),
			how_to_reach: opt(1000),
			nearest_station: opt(1000),
			nearest_bus_stop: opt(1000),
			monsoon_status: z
				.string()
				.toLowerCase()
				.transform((s) => s || 'open')
				.pipe(z.enum(['open', 'risky', 'closed'])),
			monsoon_reason: opt(1000),
			is_tide_dependent: yesNo,
			is_hidden_gem: yesNo,
			short_story: opt(5000),
			history: opt(5000),
			significance: opt(5000),
			dos: opt(5000),
			donts: opt(5000),
			safety_text: opt(5000),
			// A desk row must cite where it was checked (the DB refuses one without): 1–10 https links.
			source_urls: z
				.string()
				.transform((s) => s.split(/[\s;]+/).filter(Boolean))
				.pipe(z.array(z.url({ protocol: /^https$/ })).min(1).max(10))
		})
		.refine((r) => (r.opens == null) === (r.closes == null), {
			path: ['closes'],
			message: 'give both opens and closes, or neither'
		});
}

export type Row = z.infer<ReturnType<typeof rowSchema>>;

/** place_hours rows: the same times every day except the closed days; none when no times are given. */
export function hoursOf(r: Row) {
	if (r.opens == null) return [];
	return [0, 1, 2, 3, 4, 5, 6].map((weekday) =>
		(r.closed_days as number[]).includes(weekday)
			? { weekday, opens: null, closes: null }
			: { weekday, opens: r.opens, closes: r.closes }
	);
}

/** A readable reason from a Zod error: "taluka: unknown taluka; lat: …". */
export const reason = (e: z.ZodError) =>
	e.issues.map((i) => `${i.path.join('.') || 'row'}: ${i.message}`).join('; ');
