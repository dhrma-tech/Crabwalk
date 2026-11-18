// Hardening T2-03 (AI-03, AI Spec 5.3–5.4): the explanation is JSON {text, cites, facts, confidence}, and its text
// may only state what this turn's tool results contain. Pure functions: no I/O, no model.
import { z } from 'zod';

export const KINDS = ['place', 'stay', 'eatery', 'dish'] as const;
export const explanation = z
	.object({
		text: z.string().max(900),
		cites: z
			.array(
				z.object({ kind: z.enum(KINDS), slug: z.string().regex(/^[a-z0-9-]{1,120}$/) }).strict()
			)
			.max(8),
		facts: z
			.array(z.object({ value: z.string().max(40), tool: z.number().int().min(0) }).strict())
			.max(12),
		confidence: z.enum(['answered', 'partial', 'unknown'])
	})
	.strict();
export type Explanation = z.infer<typeof explanation>;

/** The schema as the model is told it (AI Spec 5.3). */
export const EXPLANATION_SCHEMA = `{"text": string ≤ 900 chars, "cites": [{"kind": "place"|"stay"|"eatery"|"dish", "slug": slug from the results}] ≤ 8, "facts": [{"value": string ≤ 40 chars copied from a result, "tool": index of that result}] ≤ 12, "confidence": "answered"|"partial"|"unknown"}`;

const DEVANAGARI = '०१२३४५६७८९';
/** Devanagari digits → ASCII, lower case, no thousands separators. */
const norm = (s: string) =>
	s
		.replace(/[०-९]/g, (d) => String(DEVANAGARI.indexOf(d)))
		.toLowerCase()
		.replace(/(\d),(?=\d)/g, '$1');
const num = (s: string) => String(Number(s));
const clock = (h: number, m: string) => `${h}:${m}`;

/** Every `slug` and every (name, slug) pair of a listing in the results, at any depth. */
function listings(v: unknown, slugs = new Set<string>(), named: [string, string][] = []) {
	if (Array.isArray(v)) v.forEach((x) => listings(x, slugs, named));
	else if (v && typeof v === 'object') {
		const o = v as Record<string, unknown>;
		if (typeof o.slug === 'string') {
			slugs.add(o.slug);
			for (const k of ['name', 'name_en', 'name_hi', 'name_mr'])
				if (typeof o[k] === 'string' && (o[k] as string).trim().length >= 3)
					named.push([(o[k] as string).trim(), o.slug]);
		}
		Object.values(o).forEach((x) => listings(x, slugs, named));
	}
	return { slugs, named };
}

/** Slug → the first name the results give it (labels for cite chips). */
export function listingNames(results: unknown) {
	const names = new Map<string, string>();
	for (const [name, slug] of listings(results).named) if (!names.has(slug)) names.set(slug, name);
	return names;
}

export function check(
	e: Explanation,
	results: unknown
): { ok: true } | { ok: false; errors: string[] } {
	const errors: string[] = [];
	const { slugs, named } = listings(results);
	const src = norm(JSON.stringify(results ?? null));
	const numbers = new Set([...src.matchAll(/\d+(?:\.\d+)?/g)].map((x) => num(x[0])));
	const times = new Set(
		[...src.matchAll(/\b(\d{1,2})[:.](\d{2})\b/g)].map((x) => clock(+x[1]!, x[2]!))
	);
	const want = (kind: string, n: string) =>
		!numbers.has(num(n)) && errors.push(`${kind} "${n}" is not in the tool results`);

	// 1. Cited slugs come from the results.
	for (const c of e.cites)
		if (!slugs.has(c.slug)) errors.push(`cite "${c.slug}" is not in the tool results`);
	// 2. A listing named in the text is cited.
	const low = e.text.toLowerCase();
	const cited = new Set(e.cites.map((c) => c.slug));
	for (const [name, slug] of named)
		if (low.includes(name.toLowerCase()) && !cited.has(slug))
			errors.push(`"${name}" is mentioned, so cite slug "${slug}"`);

	// 3. Prices, distances, percentages, times and dates in the text appear in the results.
	let t = norm(e.text);
	const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
		for (const m of t.matchAll(re)) fn(m);
		t = t.replace(re, ' ');
	};
	take(/(?:₹|\brs\.?)\s?(\d+(?:\.\d+)?)/g, (m) => want('price', m[1]!));
	take(/(\d+(?:\.\d+)?)\s?(?:km|m)\b/g, (m) => want('distance', m[1]!));
	take(/(\d+(?:\.\d+)?)\s?%/g, (m) => want('percentage', m[1]!));
	take(/\b(\d{4}-\d{2}-\d{2})\b/g, (m) => {
		if (!src.includes(m[1]!)) errors.push(`date "${m[1]}" is not in the tool results`);
	});
	// "5:30 pm" matches 17:30 or 5:30 in the results; "9 am" matches 9:00.
	const time = (m: RegExpMatchArray, h: string, min: string, ap?: string) => {
		const h24 = (+h % 12) + (ap === 'pm' ? 12 : 0);
		if (!times.has(clock(+h, min)) && !(ap && times.has(clock(h24, min))))
			errors.push(`time "${m[0].trim()}" is not in the tool results`);
	};
	take(/\b(\d{1,2})[:.](\d{2})\s?(am|pm)?\b/g, (m) => time(m, m[1]!, m[2]!, m[3]));
	take(/\b(\d{1,2})\s?(am|pm)\b/g, (m) => time(m, m[1]!, '00', m[2]));

	// 4. No links, email addresses or long digit runs (phone numbers).
	if (/https?:\/\/|www\./i.test(e.text)) errors.push('no links in the text');
	if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(e.text)) errors.push('no email addresses in the text');
	if (/\d{8,}/.test(norm(e.text))) errors.push('no long numbers in the text');

	// 5. Unknown means nothing is claimed.
	if (e.confidence === 'unknown' && (e.cites.length || e.facts.length))
		errors.push('confidence "unknown" must have no cites and no facts');
	return errors.length ? { ok: false, errors } : { ok: true };
}

/** Parse + schema + rules; schema failures are errors too (they go into the retry message). */
export function ground(raw: string, results: unknown) {
	let json: unknown;
	try {
		json = JSON.parse(raw);
	} catch {
		return { ok: false as const, errors: ['the reply was not valid JSON'] };
	}
	const p = explanation.safeParse(json);
	if (!p.success)
		return {
			ok: false as const,
			errors: p.error.issues.map((i) => `${i.path.join('.') || 'reply'}: ${i.message}`)
		};
	const r = check(p.data, results);
	return r.ok ? { ok: true as const, value: p.data } : r;
}
