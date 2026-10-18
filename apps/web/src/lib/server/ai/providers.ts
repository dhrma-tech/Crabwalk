// LLM providers behind one interface (BACKEND §11.1, §11.7: Sarvam can be added as another Provider).
// AI firewall: nothing in this folder may reach the maps proxy or its key (scripts/check-ai-firewall.mjs).
import { GEMINI_API_KEY, GROQ_API_KEY } from '$app/env/private';

export type Role = 'system' | 'user' | 'assistant' | 'tool';
export type ToolCall = { id: string; name: string; args: string };
export type Msg = {
	role: Role;
	content: string;
	tool_calls?: ToolCall[];
	tool_call_id?: string;
};
export type ToolDef = { name: string; description: string; parameters: Record<string, unknown> };
export type ChatRequest = {
	model: string;
	messages: Msg[];
	tools?: ToolDef[];
	json?: boolean;
	maxTokens?: number;
};
export type ChatResult = { content: string; tool_calls: ToolCall[] };

/** Thrown for provider failures; the router moves on for 429, 5xx and network errors. */
export class ProviderError extends Error {
	constructor(
		readonly provider: string,
		readonly status: number,
		message: string
	) {
		super(`${provider} ${status}: ${message}`);
	}
}

export interface Provider {
	name: string;
	chat(req: ChatRequest): Promise<ChatResult>;
}

async function post(provider: string, url: string, headers: Record<string, string>, body: unknown) {
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...headers },
		body: JSON.stringify(body)
	}).catch((e: unknown) => {
		throw new ProviderError(provider, 0, e instanceof Error ? e.message : 'network');
	});
	if (!res.ok) throw new ProviderError(provider, res.status, (await res.text()).slice(0, 200));
	return res.json();
}

/** Groq: OpenAI-compatible chat completions with tool calling. */
export const groq: Provider = {
	name: 'groq',
	async chat(req) {
		if (!GROQ_API_KEY) throw new ProviderError('groq', 503, 'GROQ_API_KEY not set');
		const body = {
			model: req.model,
			messages: req.messages.map((m) => ({
				role: m.role,
				content: m.content,
				...(m.tool_calls?.length
					? {
							tool_calls: m.tool_calls.map((t) => ({
								id: t.id,
								type: 'function',
								function: { name: t.name, arguments: t.args }
							}))
						}
					: {}),
				...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {})
			})),
			...(req.tools?.length
				? { tools: req.tools.map((t) => ({ type: 'function', function: t })), tool_choice: 'auto' }
				: {}),
			...(req.json ? { response_format: { type: 'json_object' } } : {}),
			max_tokens: req.maxTokens ?? 800,
			temperature: 0.2
		};
		const r = (await post(
			'groq',
			'https://api.groq.com/openai/v1/chat/completions',
			{ Authorization: `Bearer ${GROQ_API_KEY}` },
			body
		)) as {
			choices: {
				message: {
					content: string | null;
					tool_calls?: { id: string; function: { name: string; arguments: string } }[];
				};
			}[];
		};
		const msg = r.choices[0]?.message;
		return {
			content: msg?.content ?? '',
			tool_calls: (msg?.tool_calls ?? []).map((t) => ({
				id: t.id,
				name: t.function.name,
				args: t.function.arguments
			}))
		};
	}
};

/** Gemini: staff content drafting only (DECISIONS P8-1) — no tools, no traveller text. */
export const gemini: Provider = {
	name: 'gemini',
	async chat(req) {
		if (!GEMINI_API_KEY) throw new ProviderError('gemini', 503, 'GEMINI_API_KEY not set');
		const msgs = req.messages;
		const system = msgs
			.filter((m) => m.role === 'system')
			.map((m) => m.content)
			.join('\n\n');
		const body = {
			...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
			contents: msgs
				.filter((m) => m.role === 'user' || m.role === 'assistant')
				.map((m) => ({
					role: m.role === 'assistant' ? 'model' : 'user',
					parts: [{ text: m.content }]
				})),
			generationConfig: {
				temperature: 0.3,
				maxOutputTokens: req.maxTokens ?? 2000,
				...(req.json ? { responseMimeType: 'application/json' } : {})
			}
		};
		const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(req.model)}:generateContent`;
		const r = (await post('gemini', url, { 'x-goog-api-key': GEMINI_API_KEY }, body)) as {
			candidates?: { content?: { parts?: { text?: string }[] } }[];
		};
		return {
			content: r.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '',
			tool_calls: []
		};
	}
};
