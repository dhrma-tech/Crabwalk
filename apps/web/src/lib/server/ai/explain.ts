// Hardening T2-03 (AI Spec 5.2–5.4): the explanation call in JSON mode, checked by `ground`; one retry with the
// errors; null after a second failure (the caller answers "don't know"). Validated before anything is shown, so
// the reply is streamed to the client only after it passes.
import type { Msg } from './providers.ts';
import { chain, route } from './router.ts';
import { EXPLANATION_SCHEMA, ground, type Explanation } from './ground.ts';

export const GROUNDING_RULES = `Reply ONLY with JSON: ${EXPLANATION_SCHEMA}.
Write the reply in "text". Cite every listing you name. Copy times, prices, distances, percentages and dates
exactly as they appear in the results. No links, emails or phone numbers. When the results do not answer the
question: confidence "unknown" with no cites and no facts.`;

export async function explainGrounded(
	messages: Msg[],
	results: unknown,
	maxTokens = 600
): Promise<Explanation | null> {
	const ask = (extra: Msg[]) =>
		route(chain('explain'), { messages: [...messages, ...extra], json: true, maxTokens });
	const first = await ask([]);
	const g = ground(first.content, results);
	if (g.ok) return g.value;
	const again = await ask([
		{ role: 'assistant', content: first.content },
		{
			role: 'system',
			content: `That reply broke these rules:\n- ${g.errors.join('\n- ')}\nAnswer again with corrected JSON.`
		}
	]);
	const h = ground(again.content, results);
	return h.ok ? h.value : null;
}
