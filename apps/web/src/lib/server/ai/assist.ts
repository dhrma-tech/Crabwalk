// Small Crabby helpers outside the chat: group-vote merge with trade-offs (PLAN P8 task 8) and the
// stay price-compare tip (task 11). Both count against the daily cap and use only data we pass in.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/db.types.ts';
import type { Lang } from '../listings.ts';
import { chain, route } from './router.ts';
import { runTool, type Ctx, type Proposed } from './tools.ts';

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

export async function mergeVotes(db: DB, userId: string, tripId: string, lang: Lang) {
	if (!(await takeMessage(db))) return { kind: 'limit' as const };
	const ctx: Ctx = { db, userId, lang, trips: new Map([['T1', tripId]]), proposed: [] };
	const result = (await runTool(
		ctx,
		'merge_group_votes',
		JSON.stringify({ trip: 'T1' })
	)) as Record<string, unknown>;
	const action: Proposed | undefined = ctx.proposed[0];
	if (!action)
		return {
			kind: 'nothing' as const,
			votes: (result.votes as unknown[] | undefined)?.length ?? 0
		};
	try {
		const r = await route(chain('explain'), {
			messages: [
				{
					role: 'system',
					content: `You are Crabby. In ${LANG[lang]}, explain in 2–3 short sentences what this merge of friends' votes changes and the trade-off (who loses a spot they liked, what time it frees). Use ONLY the RESULTS. Say nothing changes until they tap Apply.`
				},
				{
					role: 'user',
					content: `RESULTS: ${JSON.stringify({ changes: result.changes, votes: result.votes })}`
				}
			],
			maxTokens: 200
		});
		return { kind: 'merge' as const, text: r.content.trim(), action };
	} catch {
		return { kind: 'merge' as const, text: '', action }; // the preview alone still works
	}
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
