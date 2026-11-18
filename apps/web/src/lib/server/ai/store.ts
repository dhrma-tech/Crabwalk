// Hardening T2-05 (AI-09, AI-10): cache and turn log for Crabby. Like the budget (router.ts), the implementation
// is handed in by hooks.server.ts (lib/server/aiStore.ts): AI code never holds the service key. Not set (unit
// tests) → no cache and no log.
import type { Lang } from '../listings.ts';

export type Outcome = 'answer' | 'unknown' | 'refused' | 'off_topic' | 'unavailable';
/** One turn, no text: what happened, which tools, how long. */
export type TurnLog = {
	lang: Lang;
	outcome: Outcome;
	tools: string[];
	rounds: number;
	latencyMs: number;
	validatorRetries: number;
	cached: boolean;
};
export type AiStore = {
	get(key: string): Promise<unknown>;
	put(key: string, value: unknown, ttlS: number): Promise<void>;
	logTurn(t: TurnLog): Promise<number | null>;
};

let store: AiStore | undefined;
export const setStore = (s: AiStore | undefined) => {
	store = s;
};
export const aiStore = () => store;

/** SHA-256 hex of the parts (object keys sorted, so argument order does not matter). */
export async function cacheKey(...parts: unknown[]) {
	const sorted = (v: unknown): unknown =>
		Array.isArray(v)
			? v.map(sorted)
			: v && typeof v === 'object'
				? Object.fromEntries(
						Object.keys(v)
							.sort()
							.map((k) => [k, sorted((v as Record<string, unknown>)[k])])
					)
				: v;
	const bytes = new TextEncoder().encode(JSON.stringify(sorted(parts)));
	const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
	return [...hash].map((b) => b.toString(16).padStart(2, '0')).join('');
}
