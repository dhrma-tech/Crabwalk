// Nightly (pg_cron): review summary per listing per language (BACKEND §5, PLAN P8 task 9).
// Only approved reviews with text; only listings whose reviews changed since the last summary; ≥ 3 reviews.
// The model may only restate what reviewers wrote (no invented facts). Groq only (DECISIONS P8-1).
import { admin, authorized, json } from '../_shared/cron.ts';
import { groqJson } from '../_shared/groq.ts';

const PROMPT = `Summarise traveller reviews of one listing in Konkan, India. Use ONLY what the reviews say.
Mention common praise and common complaints; no names, no contact details, no invented facts.
2 sentences per language. Reply ONLY with JSON {"en": "...", "hi": "... (Devanagari)", "mr": "... (Marathi, Devanagari)"}.`;
const MIN_REVIEWS = 3;
const MAX_PER_RUN = 40; // free-tier friendly

Deno.serve(async (req) => {
	if (!authorized(req)) return json({ error: 'unauthorized' }, 401);
	const db = admin();
	const { data: reviews, error } = await db
		.from('reviews')
		.select('entity_type, entity_id, text, updated_at, created_at')
		.eq('moderation_status', 'approved')
		.not('text', 'is', null)
		.order('created_at', { ascending: false })
		.limit(5000);
	if (error) return json({ error: error.message }, 500);
	const { data: done } = await db.from('review_summaries').select('entity_type, entity_id, generated_at').eq('lang', 'en');
	const last = new Map((done ?? []).map((d) => [`${d.entity_type}:${d.entity_id}`, d.generated_at as string]));

	const groups = new Map<string, { type: string; id: string; texts: string[]; newest: string }>();
	for (const r of reviews ?? []) {
		const k = `${r.entity_type}:${r.entity_id}`;
		const g = groups.get(k) ?? { type: r.entity_type, id: r.entity_id, texts: [], newest: '' };
		g.texts.push(r.text as string);
		const t = (r.updated_at ?? r.created_at) as string;
		if (t > g.newest) g.newest = t;
		groups.set(k, g);
	}
	let written = 0;
	const failed: string[] = [];
	for (const [k, g] of groups) {
		if (written >= MAX_PER_RUN) break;
		if (g.texts.length < MIN_REVIEWS || (last.get(k) ?? '') > g.newest) continue;
		try {
			const out = (await groqJson(PROMPT, g.texts.slice(0, 30).map((t, i) => `${i + 1}. ${t.slice(0, 600)}`).join('\n'))) as Record<string, string>;
			const rows = (['en', 'hi', 'mr'] as const)
				.filter((l) => typeof out[l] === 'string' && out[l].trim())
				.map((lang) => ({ entity_type: g.type, entity_id: g.id, lang, summary: out[lang].trim().slice(0, 800), generated_at: new Date().toISOString() }));
			if (rows.length) {
				const { error: e } = await db.from('review_summaries').upsert(rows, { onConflict: 'entity_type,entity_id,lang' });
				if (e) throw e;
				written++;
			}
		} catch (e) {
			failed.push(`${k}: ${e instanceof Error ? e.message : e}`);
			if (String(e).includes('429')) break; // out of quota for tonight
		}
	}
	return json({ written, failed: failed.length });
});
