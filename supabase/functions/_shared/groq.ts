// Groq chat for Edge Functions (DECISIONS P8-1: traveller-derived text → Groq only). 429 / 5xx → next model.
// Same scrub rules as the web router: no phone numbers or coordinates leave the server.
const PHONE = /(?:\+?91[\s-]?)?(?:\(?0\d{2,4}\)?[\s-]?)?\d{3,5}[\s-]?\d{3,5}(?:[\s-]?\d{2,4})?/g;
const COORD = /-?\d{1,3}\.\d{3,}(?:\s*,\s*-?\d{1,3}\.\d{3,})?/g;
export const scrub = (t: string) =>
	t.replace(COORD, '[location removed]').replace(PHONE, (m) => (m.replace(/\D/g, '').length >= 8 ? '[number removed]' : m));

export async function groqJson(system: string, user: string): Promise<unknown> {
	const key = Deno.env.get('GROQ_API_KEY');
	if (!key) throw new Error('GROQ_API_KEY not set');
	const models = [Deno.env.get('AI_MODEL_INTENT') || 'llama-3.1-8b-instant', Deno.env.get('AI_MODEL_EXPLAIN') || 'llama-3.3-70b-versatile'];
	let last = '';
	for (const model of models) {
		const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
			body: JSON.stringify({
				model,
				messages: [
					{ role: 'system', content: system },
					{ role: 'user', content: scrub(user) }
				],
				response_format: { type: 'json_object' },
				temperature: 0.2,
				max_tokens: 900
			})
		});
		if (res.ok) {
			const r = await res.json();
			return JSON.parse(r.choices?.[0]?.message?.content ?? '{}');
		}
		last = `${model} ${res.status}`;
		if (res.status !== 429 && res.status < 500) break;
	}
	throw new Error(`groq failed: ${last}`);
}
