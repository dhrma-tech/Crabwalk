// Provider router (BACKEND §11.1 as overridden by DECISIONS P8-1). On 429 (or 5xx / network / missing key)
// the next link in the chain is tried. No paid fallback. Model IDs come from env.
import { AI_MODEL_DRAFT, AI_MODEL_EXPLAIN, AI_MODEL_INTENT, AI_PROVIDER } from '$app/env/private';
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

export type Task = 'intent' | 'explain' | 'draft';
type Link = { provider: Provider; model: string };

const INTENT = () => AI_MODEL_INTENT || 'llama-3.1-8b-instant';
const EXPLAIN = () => AI_MODEL_EXPLAIN || 'llama-3.3-70b-versatile';
const DRAFT = () => AI_MODEL_DRAFT || 'gemini-3.5-flash-lite';

/** Traveller-facing tasks never reach Gemini (free tier trains on prompts — P8-1). */
export function chain(task: Task): Link[] {
	if (AI_PROVIDER === 'mock') return [{ provider: mock, model: `mock-${task}` }];
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
	e instanceof ProviderError && (e.status === 429 || e.status === 0 || e.status >= 500);

/** Runs the request down the chain; throws the last error when every link fails. */
export async function route(
	links: Link[],
	req: Omit<ChatRequest, 'model'>
): Promise<ChatResult & { provider: string; model: string }> {
	let last: unknown = new Error('no providers');
	for (const l of links) {
		try {
			// Last guard: no phone numbers / coordinates in any payload (CLAUDE.md §2).
			const safe: ChatRequest = { ...req, model: l.model, messages: scrubMessages(req.messages) };
			audit.onPayload?.(l.provider.name, safe);
			const r = await l.provider.chat(safe);
			return { ...r, provider: l.provider.name, model: l.model };
		} catch (e) {
			last = e;
			if (!retryable(e)) throw e;
		}
	}
	throw last;
}
