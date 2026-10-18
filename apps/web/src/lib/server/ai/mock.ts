// Scripted provider for tests and local e2e (AI_PROVIDER=mock; DECISIONS P8-2). Deterministic:
// picks tools from keywords, explains only from the TOOL RESULTS block, like the real prompts require.
import type { ChatRequest, ChatResult, Provider, ToolCall } from './providers.ts';

const CATS = [
	'beach',
	'fort',
	'temple',
	'waterfall',
	'viewpoint',
	'backwater',
	'cave',
	'museum',
	'village',
	'market',
	'orchard'
];
let seq = 0;
const call = (name: string, args: unknown): ToolCall => ({
	id: `mock_${++seq}`,
	name,
	args: JSON.stringify(args)
});

/** Payloads seen by the mock, newest last (inspected by the e2e "no PII in payload" check). */
export const mockLog: ChatRequest[] = [];

export const mock: Provider = {
	name: 'mock',
	async chat(req): Promise<ChatResult> {
		mockLog.push(req);
		if (mockLog.length > 200) mockLog.shift();
		const sys = req.messages[0]?.content ?? '';
		const user = [...req.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
		const text = user.toLowerCase();

		if (sys.startsWith('You pre-screen'))
			return {
				content: JSON.stringify({
					flag: text.includes('mockspam'),
					reason: text.includes('mockspam') ? 'spam' : ''
				}),
				tool_calls: []
			};
		if (sys.startsWith('You screen'))
			return { content: JSON.stringify({ safe: !text.includes('mockunsafe') }), tool_calls: [] };

		if (req.tools?.length) {
			const done = req.messages.filter(
				(m) => m.role === 'assistant' && m.tool_calls?.length
			).length;
			const plan: ToolCall[][] = [];
			if (text.includes('merge'))
				plan.push([call('list_my_trips', {})], [call('merge_group_votes', { trip: 'T1' })]);
			else if (text.includes('plan')) {
				const from = /from ([\p{L}\p{N} ]+?)(?: for|$)/u.exec(user)?.[1]?.trim() ?? '';
				plan.push([
					call('build_plan', {
						days: 1,
						start: from,
						interests: CATS.filter((c) => text.includes(c))
					})
				]);
			} else if (text.includes('stays near')) {
				const slug = /stays near ([a-z0-9-]+)/.exec(text)?.[1] ?? '';
				plan.push([call('search_stays', { near_place: slug })]);
			} else if (text.includes('unicorn')) plan.push([call('search_places', { name: 'unicorn' })]);
			else {
				const cat = CATS.find((c) => text.includes(c));
				if (cat) plan.push([call('search_places', { category: cat })]);
			}
			return { content: '', tool_calls: plan[done] ?? [] };
		}

		if (sys.includes('content drafting')) {
			return {
				content: JSON.stringify({
					en: { short_story: 'Mock draft.' },
					hi: { short_story: 'मॉक ड्राफ्ट।' },
					mr: { short_story: 'मॉक मसुदा.' }
				}),
				tool_calls: []
			};
		}

		// Explanation: only names found in the TOOL RESULTS block.
		const block = req.messages.find((m) => m.content.startsWith('TOOL RESULTS:'))?.content ?? '';
		const names = [...block.matchAll(/"name":"([^"]+)"/g)].map((x) => x[1]);
		const previews = /PROPOSED PREVIEWS: (.+)$/m.exec(block)?.[1];
		if (previews)
			return {
				content: `Mock: your ${previews} preview is ready. Nothing changes until you tap Apply.`,
				tool_calls: []
			};
		return {
			content: names.length
				? `Mock: ${[...new Set(names)].slice(0, 5).join(', ')}.`
				: "Mock: I don't know that.",
			tool_calls: []
		};
	}
};
