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
	/** Vision only (P12 snap and ask / reel screenshots): data URLs of photos, EXIF stripped on the phone. */
	images?: string[];
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
	/** Text only, in chunks as they are generated (T2-02). Providers without it are called with `chat`. */
	chatStream?(req: ChatRequest): AsyncIterable<string>;
}

async function send(provider: string, url: string, headers: Record<string, string>, body: unknown) {
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...headers },
		body: JSON.stringify(body)
	}).catch((e: unknown) => {
		throw new ProviderError(provider, 0, e instanceof Error ? e.message : 'network');
	});
	if (!res.ok) throw new ProviderError(provider, res.status, (await res.text()).slice(0, 200));
	return res;
}
const post = async (
	provider: string,
	url: string,
	headers: Record<string, string>,
	body: unknown
) => (await send(provider, url, headers, body)).json();

/** `data:` payloads of a server-sent event stream, until `[DONE]`. */
async function* sseData(body: ReadableStream<Uint8Array>) {
	const dec = new TextDecoder();
	let buf = '';
	for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
		buf += dec.decode(chunk, { stream: true });
		let i;
		while ((i = buf.indexOf('\n')) >= 0) {
			const line = buf.slice(0, i).trim();
			buf = buf.slice(i + 1);
			if (!line.startsWith('data:')) continue;
			const data = line.slice(5).trim();
			if (data === '[DONE]') return;
			yield data;
		}
	}
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

/** Groq: OpenAI-compatible chat completions with tool calling. */
export const groq: Provider = {
	name: 'groq',
	async *chatStream(req) {
		if (!GROQ_API_KEY) throw new ProviderError('groq', 503, 'GROQ_API_KEY not set');
		const res = await send(
			'groq',
			GROQ_URL,
			{ Authorization: `Bearer ${GROQ_API_KEY}` },
			{ ...groqBody(req), stream: true }
		);
		if (!res.body) throw new ProviderError('groq', 0, 'no body');
		for await (const data of sseData(res.body)) {
			const d = JSON.parse(data) as { choices?: { delta?: { content?: string | null } }[] };
			const text = d.choices?.[0]?.delta?.content;
			if (text) yield text;
		}
	},
	async chat(req) {
		if (!GROQ_API_KEY) throw new ProviderError('groq', 503, 'GROQ_API_KEY not set');
		const r = (await post(
			'groq',
			GROQ_URL,
			{ Authorization: `Bearer ${GROQ_API_KEY}` },
			groqBody(req)
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

function groqBody(req: ChatRequest) {
	return {
		model: req.model,
		messages: req.messages.map((m) => ({
			role: m.role,
			content: m.images?.length
				? [
						{ type: 'text', text: m.content },
						...m.images.map((url) => ({ type: 'image_url', image_url: { url } }))
					]
				: m.content,
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
}

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
