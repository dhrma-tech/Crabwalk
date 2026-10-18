// Staff content helper (PLAN P8 task 9, DECISIONS P8-1): drafts missing EN text from the verifier's facts and
// translates into HI/MR. Gemini first (staff data only, never traveller text), Groq 70B fallback.
// Output only fills EMPTY fields as content_drafts; the reviewer edits and approves as before (P4-4).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/db.types.ts';
import { entity, FIELDS, LANGS, loadText, type ReviewType } from '../review.ts';
import { chain, route } from './router.ts';

type DB = SupabaseClient<Database>;

// Never sent: contacts, coordinates, owner/staff ids, status/bookkeeping.
const OMIT =
	/^(id|phone|whatsapp|location|taluka_id|owner_id|status|created_at|updated_at|next_recheck_at|last_verified_at|is_seed|tide_station_id|slug)$/;

const PROMPT = (
	type: ReviewType,
	fields: string[]
) => `You are a content drafting helper for Crabwalk, a Konkan travel app.
Write listing text for a ${type} using ONLY the FACTS and EXISTING TEXT given. Never add history, dates, legends,
numbers, timings or claims that are not in them. If a field cannot be written from the facts, omit it.
Fields: ${fields.join(', ')}. "dos"/"donts" are short bullet lines separated by newlines.
Translate into Hindi and Marathi (natural, Devanagari script; Marathi written natively, not word-for-word).
Reply ONLY with JSON: {"en":{field:text},"hi":{field:text},"mr":{field:text}}.`;

export async function draftContent(db: DB, type: ReviewType, id: string) {
	const [row, text] = await Promise.all([entity(db, type, id), loadText(db, type, id)]);
	if (!row) return { filled: 0 };
	const facts = Object.fromEntries(
		Object.entries(row).filter(
			([k, v]) =>
				!OMIT.test(k) &&
				v != null &&
				v !== '' &&
				!(typeof v === 'object' && !Object.keys(v as object).length)
		)
	);
	const fields = FIELDS[type].filter((f) => f !== 'name' || !text.en.name);
	const r = await route(chain('draft'), {
		messages: [
			{ role: 'system', content: PROMPT(type, fields) },
			{
				role: 'user',
				content: `FACTS:\n${JSON.stringify(facts)}\n\nEXISTING TEXT:\n${JSON.stringify(text)}`
			}
		],
		json: true,
		maxTokens: 2500
	});
	let out: Record<string, Record<string, string>>;
	try {
		out = JSON.parse(r.content.replace(/^```(?:json)?|```$/g, '').trim());
	} catch {
		throw new Error('draft was not valid JSON');
	}
	// Only fill gaps — never overwrite text a reviewer already has.
	const rows = LANGS.flatMap((lang) =>
		FIELDS[type]
			.filter((f) => !text[lang]?.[f] && typeof out[lang]?.[f] === 'string' && out[lang][f].trim())
			.map((field) => ({
				entity_type: type,
				entity_id: id,
				lang,
				field,
				draft_text: out[lang]![field]!.trim().slice(0, 10000)
			}))
	);
	if (rows.length) {
		const { error } = await db.from('content_drafts').insert(rows);
		if (error) throw error;
	}
	return { filled: rows.length, provider: r.provider };
}
