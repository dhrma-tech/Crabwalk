// Hardening T2-07: runs one eval case through the real Crabby code (crabbyTurn, crabbyInGroup, reelToTrip, the
// review-summary prompt) and records what it did: every provider payload (router audit hook), the tools that ran
// (turn log), and the tool results the explanation saw. Shared by Vitest (mock, stub database) and
// scripts/ai-eval.ts (local stack). A fresh in-memory cache per run, so one case never answers from another.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/db.types.ts';
import {
	checkSummary,
	reviewBlock,
	SUMMARY_PROMPT,
	type Summary
} from '../../../../../../../supabase/functions/_shared/summary.ts';
import { crabbyTurn } from '../chat.ts';
import { crabbyInGroup } from '../group.ts';
import type { ChatRequest } from '../providers.ts';
import { reelToTrip } from '../reel.ts';
import { audit, chain, route } from '../router.ts';
import { setStore, type AiStore } from '../store.ts';
import type { Case, Seen } from './cases.ts';

type DB = SupabaseClient<Database>;
export type Deps = {
	db: DB;
	userId: string;
	/** S5: the trip whose group chat Crabby is tagged in. */
	tripId?: string;
	/** Runner only: prepare the database for a case (cap used up, a saved trip …). */
	before?: (c: Case) => Promise<void>;
	/** Runner only: read what the database shows after the case into `seen.extra`. */
	after?: (c: Case, seen: Seen) => Promise<void>;
};

function memoryStore(tools: string[]): AiStore {
	const m = new Map<string, { v: unknown; until: number }>();
	return {
		async get(k) {
			const e = m.get(k);
			return e && e.until > Date.now() ? e.v : null;
		},
		async put(k, v, ttl) {
			m.set(k, { v: structuredClone(v), until: Date.now() + ttl * 1000 });
		},
		async logTurn(t) {
			tools.splice(0, tools.length, ...t.tools);
			return null;
		}
	};
}

/** The tool results of the last explanation call (its TOOL RESULTS block is valid JSON, fit() keeps it so). */
function resultsOf(payloads: ChatRequest[]) {
	for (const p of [...payloads].reverse())
		for (const m of p.messages)
			if (m.content.startsWith('TOOL RESULTS:\n')) {
				try {
					return JSON.parse(m.content.split('\n')[1]!) as { tool: string; result: unknown }[];
				} catch {
					return [];
				}
			}
	return [];
}

export async function runCase(c: Case, d: Deps): Promise<Seen> {
	await d.before?.(c);
	const payloads: ChatRequest[] = [];
	const tools: string[] = [];
	setStore(memoryStore(tools));
	audit.onPayload = (_p, req) => payloads.push(req);
	const seen: Seen = {
		reply: null,
		calls: 0,
		explains: 0,
		tools,
		results: [],
		text: '',
		extra: {}
	};
	const lang = c.lang ?? 'en';
	try {
		if (c.kind === 'summary') {
			const texts = c.reviews ?? [];
			const r = await route(chain('explain'), {
				messages: [
					{ role: 'system', content: SUMMARY_PROMPT },
					{ role: 'user', content: reviewBlock(texts) }
				],
				json: true,
				maxTokens: 500
			});
			let out: Summary | null = null;
			try {
				out = JSON.parse(r.content) as Summary;
			} catch {
				// not JSON: the function skips it like any failing summary
			}
			seen.extra.summary = out
				? { text: Object.values(out).join(' '), errors: checkSummary(out, texts) }
				: { text: r.content, errors: ['not JSON'] };
		} else if (c.kind === 'group') {
			await crabbyInGroup(d.db, d.userId, d.tripId!, lang, c.message);
		} else if (c.kind === 'reel') {
			const r = await reelToTrip(d.db, d.userId, lang, {
				url: null,
				caption: c.message,
				image: null
			});
			seen.extra.reel = {
				kind: r.kind,
				slugs: r.kind === 'found' ? r.places.map((p) => p.slug) : [],
				unknownSlugs: []
			};
		} else {
			const ask = () => crabbyTurn(d.db, d.userId, lang, c.message, c.history ?? []);
			seen.reply = await ask();
			if (c.setup === 'repeat') {
				payloads.length = 0;
				seen.reply = await ask();
			}
			seen.text = seen.reply.kind === 'answer' ? seen.reply.reply : '';
		}
	} finally {
		audit.onPayload = undefined;
		setStore(undefined);
	}
	seen.calls = payloads.length;
	seen.explains = payloads.filter((p) =>
		p.messages.some((m) => m.content.startsWith('TOOL RESULTS:\n'))
	).length;
	seen.results = resultsOf(payloads);
	await d.after?.(c, seen);
	return seen;
}
