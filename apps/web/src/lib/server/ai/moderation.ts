// Review pre-screen (PLAN P5 task 5 → P8): a small model flags reviews; reviewers still decide.
// Runs with the reviewer's session when the queue opens (RLS lets reviewers set ai_flag). Text is scrubbed
// of phone numbers by the router like every payload.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/db.types.ts';
import { chain, route } from './router.ts';

type DB = SupabaseClient<Database>;

const PROMPT = `You pre-screen traveller reviews of places, stays and eateries in Konkan, India (any of English,
Hindi, Marathi). Flag a review if it has abuse, hate, sexual content, personal attacks on named people,
spam/ads/links, contact details, or is clearly unrelated to the listing. Honest negative reviews are fine.
Reply ONLY with JSON {"flag": true|false, "reason": "<= 12 words"}.`;

export async function prescreen(
	db: DB,
	reviews: { id: string; text: string | null; ai_flag: string | null }[]
) {
	const todo = reviews.filter((r) => !r.ai_flag && r.text).slice(0, 10);
	for (const r of todo) {
		try {
			const out = await route(chain('intent'), {
				messages: [
					{ role: 'system', content: PROMPT },
					{ role: 'user', content: r.text!.slice(0, 2000) }
				],
				json: true,
				maxTokens: 60
			});
			const v = JSON.parse(out.content) as { flag?: boolean; reason?: string };
			const flag = v.flag ? 'flagged' : 'ok';
			const reason = (v.reason ?? '').slice(0, 200) || null;
			await db.from('reviews').update({ ai_flag: flag, ai_reason: reason }).eq('id', r.id);
			r.ai_flag = flag;
			(r as { ai_reason?: string | null }).ai_reason = reason;
		} catch {
			break; // providers down or out of quota: reviewers work unassisted
		}
	}
}
