// Provider router (BACKEND §11.1 as overridden by DECISIONS P8-1). On 429 (or 5xx / network / missing key)
// the next link in the chain is tried. No paid fallback. Model IDs come from env.
import {
	AI_MODEL_DRAFT,
	AI_MODEL_EXPLAIN,
	AI_MODEL_INTENT,
	AI_MODEL_VISION,
	AI_PROVIDER
} from '$app/env/private';
import {
	gemini,
	groq,
	ProviderError,
	type ChatRequest,
	type ChatResult,
	type Provider
} from './providers.ts';
import { mock } from './mock.ts';
import { scrubMessages } from './scrub.ts';

/** Every payload leaving the server passes through here (tests inspect it via `onPayload`). */
export const audit: { onPayload?: (provider: string, req: ChatRequest) => void } = {};

/**
 * Global daily budget + kill switch (SEC-11), handed in by hooks.server.ts (lib/server/aiBudget.ts): AI code
 * never imports the service client. Asked before every real provider call; not set = refused.
 */
let budget: (() => Promise<boolean>) | undefined;
export const setBudget = (fn: (() => Promise<boolean>) | undefined) => {
	budget = fn;
};
class BudgetError extends ProviderError {}

export type Task = 'intent' | 'explain' | 'draft' | 'vision';
type Link = { provider: Provider; model: string };

const INTENT = () => AI_MODEL_INTENT || 'llama-3.1-8b-instant';
const EXPLAIN = () => AI_MODEL_EXPLAIN || 'llama-3.3-70b-versatile';
const DRAFT = () => AI_MODEL_DRAFT || 'gemini-3.5-flash-lite';
// P12-4: photos from travellers go to a Groq vision model only (never Gemini — P8-1).
const VISION = () => AI_MODEL_VISION || 'qwen/qwen3.8-27b';

/** Traveller-facing tasks never reach Gemini (free tier trains on prompts — P8-1). */
export function chain(task: Task): Link[] {
	if (AI_PROVIDER === 'mock') return [{ provider: mock, model: `mock-${task}` }];
	if (task === 'vision') return [{ provider: groq, model: VISION() }];
	if (task === 'intent')
		return [
			{ provider: groq, model: INTENT() },
			{ provider: groq, model: EXPLAIN() }
		];
	if (task === 'explain')
		return [
			{ provider: groq, model: EXPLAIN() },
			{ provider: groq, model: INTENT() }
		];
	return [
		{ provider: gemini, model: DRAFT() },
		{ provider: groq, model: EXPLAIN() }
	];
}

const retryable = (e: unknown) =>
	e instanceof ProviderError &&
	!(e instanceof BudgetError) &&
	(e.status === 429 || e.status === 0 || e.status >= 500);

/** Budget check, then the scrubbed request for this link (every payload leaving the server goes through here). */
async function prepare(l: Link, req: Omit<ChatRequest, 'model'>): Promise<ChatRequest> {
	// Budget first: a refused call sends nothing and is not retried on the next link.
	if (l.provider !== mock && !(await budget?.().catch(() => false)))
		throw new BudgetError('budget', 429, 'ai budget');
	// Last guard: no phone numbers / coordinates in any payload (CLAUDE.md §2).
	const safe: ChatRequest = { ...req, model: l.model, messages: scrubMessages(req.messages) };
	audit.onPayload?.(l.provider.name, safe);
	return safe;
}

/** Runs the request down the chain; throws the last error when every link fails. */
export async function route(
	links: Link[],
	req: Omit<ChatRequest, 'model'>
): Promise<ChatResult & { provider: string; model: string }> {
	let last: unknown = new Error('no providers');
	for (const l of links) {
		try {
			const r = await l.provider.chat(await prepare(l, req));
			return { ...r, provider: l.provider.name, model: l.model };
		} catch (e) {
			last = e;
			if (!retryable(e)) throw e;
		}
	}
	throw last;
}

/**
 * Streamed text (T2-02). Falls through the chain like `route` until the first chunk arrives; after that a
 * failure is thrown to the caller (half an answer cannot be continued by another model).
 */
export async function* routeStream(
	links: Link[],
	req: Omit<ChatRequest, 'model'>
): AsyncGenerator<string> {
	let last: unknown = new Error('no providers');
	for (const l of links) {
		let started = false;
		try {
			const safe = await prepare(l, req);
			if (!l.provider.chatStream) {
				yield (await l.provider.chat(safe)).content;
				return;
			}
			for await (const chunk of l.provider.chatStream(safe)) {
				started = true;
				yield chunk;
			}
			return;
		} catch (e) {
			last = e;
			if (started || !retryable(e)) throw e;
		}
	}
	throw last;
}
