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
			// P12 drive: show / open / filter / switch sections; add-to-trip previews.
			const listing = /(seed-[a-z0-9-]+)/.exec(text)?.[1];
			if (text.includes('admin'))
				plan.push([call('drive', { steps: [{ action: 'openPage', page: 'admin' }] })]);
			else if (text.includes('veg food'))
				plan.push([
					call('drive', {
						steps: [{ action: 'setFilters', page: 'food', filters: { diet: 'veg' } }]
					})
				]);
			else if (text.includes('on the map') && listing)
				plan.push([call('drive', { steps: [{ action: 'openMap', slug: listing }] })]);
			else if (text.includes('go to expenses'))
				plan.push([call('drive', { steps: [{ action: 'switchTab', section: 'expenses' }] })]);
			else if (text.includes('open my trip'))
				plan.push(
					[call('list_my_trips', {})],
					[call('drive', { steps: [{ action: 'openTrip', trip: 'T1' }] })]
				);
			else if (text.includes('to my trip') && listing)
				plan.push(
					[call('list_my_trips', {})],
					[
						call('propose_action', {
							type: 'add_to_trip',
							listing_type: 'place',
							slug: listing,
							trip: 'T1',
							day: 1
						})
					]
				);
			else if (text.includes('merge'))
				plan.push([call('list_my_trips', {})], [call('merge_group_votes', { trip: 'T1' })]);
			else if (text.includes('plan') || /^(dates|pace|group|start point|days): /m.test(text)) {
				// A plan request, or a question card's answers to one: read every user turn (history included).
				const said = req.messages
					.filter((m) => m.role === 'user')
					.map((m) => m.content)
					.join('\n');
				const low = said.toLowerCase();
				const from =
					/from ([\p{L}\p{N} ]+?)(?: for|$)/mu.exec(said)?.[1]?.trim() ??
					/^start point: (.+)$/im.exec(said)?.[1]?.trim() ??
					'';
				const args: Record<string, unknown> = {
					start: from,
					interests: CATS.filter((c) => low.includes(c))
				};
				const days = /^days: (\d)/m.exec(low)?.[1];
				if (days) args.days = Number(days);
				else if (/\bday\b/.test(low)) args.days = 1;
				if (/^dates: tomorrow/m.test(low))
					args.start_date = new Date(Date.now() + (5.5 + 24) * 3600e3).toISOString().slice(0, 10);
				const group = /^group: (family|couple|solo|friends)/m.exec(low)?.[1];
				if (group) args.group_type = group;
				const pace = /^pace: (relaxed|balanced|packed)/m.exec(low)?.[1];
				if (pace) args.pace = pace;
				const decides = [...low.matchAll(/^(days|pace): let crabby decide/gm)].map((x) => x[1]);
				if (decides.length) args.crabby_decides = decides;
				plan.push([call('build_plan', args)]);
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
		if (/^REFUSED: /m.test(block))
			return { content: "Mock: I can't open that page.", tool_calls: [] };
		if (/^QUESTIONS: /m.test(block))
			return { content: 'Mock: a few quick questions first.', tool_calls: [] };
		const chose = /^CRABBY CHOSE: (.+)$/m.exec(block)?.[1];
		if (chose)
			return {
				content: `Mock: your preview is ready. Nothing changes until you tap Apply. I picked ${chose}`,
				tool_calls: []
			};
		if (/^DOING: /m.test(block))
			return { content: 'Mock: on it — opening that for you.', tool_calls: [] };
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
