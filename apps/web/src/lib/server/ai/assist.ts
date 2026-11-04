// Small Crabby helper outside the chat: the stay price-compare tip (PLAN P8 task 11). It counts against the
// daily cap and uses only data we pass in. (The group-vote merge, task 8, became the trip chat — P12.)
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/db.types.ts';
import type { Lang } from '../listings.ts';
import { chain, route } from './router.ts';

type DB = SupabaseClient<Database>;
const LANG: Record<Lang, string> = {
	en: 'English',
	hi: 'Hindi (Devanagari)',
	mr: 'Marathi (Devanagari)'
};

async function takeMessage(db: DB) {
	const { error } = await db.rpc('ai_take_message');
	if (error?.code === 'CW429') return false;
	if (error) throw error;
	return true;
}

export async function priceTip(
	db: DB,
	lang: Lang,
	rows: { label: string; price: string | null; source: string }[]
) {
	const priced = rows.filter((r) => r.price);
	if (priced.length < 2) return { kind: 'few' as const };
	if (!(await takeMessage(db))) return { kind: 'limit' as const };
	const r = await route(chain('intent'), {
		messages: [
			{
				role: 'system',
				content: `In ${LANG[lang]}, write ONE short sentence comparing these stay price options (which is lowest, and that each row shows its source). Use ONLY the rows. No advice beyond them, no invented prices.`
			},
			{ role: 'user', content: JSON.stringify(priced) }
		],
		maxTokens: 80
	});
	return { kind: 'tip' as const, text: r.content.trim() };
}
