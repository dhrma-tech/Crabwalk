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

		// P12 group chat: speak when the newest message asks something; polls and plan changes on cue.
		const last = text.split('\n').at(-1) ?? '';
		if (sys.startsWith('You decide whether Crabby'))
			return { content: JSON.stringify({ speak: last.includes('?') }), tool_calls: [] };
		if (sys.includes("inside a trip's group chat") && req.tools?.length) {
			const done = req.messages.filter(
				(m) => m.role === 'assistant' && m.tool_calls?.length
			).length;
			const found = req.messages
				.filter((m) => m.role === 'tool')
				.flatMap((m) => [...m.content.matchAll(/"name":"([^"]+)"/g)].map((x) => x[1]!));
			const gplan: ToolCall[][] = [];
			const drop = /drop (seed-[a-z0-9-]+)/.exec(last)?.[1];
			if (last.includes('which beach'))
				gplan.push(
					[call('search_places', { category: 'beach' })],
					[call('ask_group', { question: 'Which beach?', options: found.slice(0, 2) })]
				);
			else if (drop)
				gplan.push([
					call('edit_plan', { trip: 'T1', ops: [{ op: 'remove', day: 1, place: drop }] })
				]);
			else {
				const cat = CATS.find((c) => last.includes(c));
				if (cat) gplan.push([call('search_places', { category: cat })]);
			}
			return { content: '', tool_calls: gplan[done] ?? [] };
		}
		// P12 vision (snap and ask, reel screenshots): the mock can't see, so the caption steers it.
		if (req.model === 'mock-vision') {
			const said = text;
			const out = /seed fort 1/.test(said)
				? { kind: 'place', name_guess: 'Seed Fort 1', category: 'fort', keywords: ['fort'] }
				: /fort/.test(said)
					? { kind: 'place', name_guess: null, category: 'fort', keywords: ['fort', 'walls'] }
					: { kind: 'other', name_guess: null, category: null, keywords: ['statue', 'garden'] };
			return { content: JSON.stringify(out), tool_calls: [] };
		}
		// P12 trip journal: the story is the traveller's own lines, in order (nothing added).
		if (sys.startsWith("Write the traveller's trip story")) {
			const f = JSON.parse(user) as { stops: { said: string | null }[]; whole_trip: string | null };
			const said = [...f.stops.map((s) => s.said), f.whole_trip].filter(Boolean);
			return { content: `Mock story: ${said.join(' ')}`, tool_calls: [] };
		}
		// P12 reel to trip: a Marathi "temple" caption names Seed Temple 1; anything else names nothing.
		if (sys.startsWith('From a travel reel'))
			return {
				content: JSON.stringify({ places: user.includes('मंदिर') ? ['Seed Temple 1'] : [] }),
				tool_calls: []
			};
		// P12 Host Crabby: prices from the owner's words; daily hours from "A to B" with "open".
		if (sys.startsWith('You fill a')) {
			const nums = [...user.matchAll(/\b(\d{3,6})\b/g)].map((x) => Number(x[1]));
			const out: Record<string, unknown> = {};
			if (sys.includes('homestay')) {
				if (nums[0]) out.price_min = nums[0];
				if (nums[1]) out.price_max = nums[1];
			} else if (nums[0]) out.price_for_two = nums[0];
			const h = /(\d{1,2})\s*(?:to|ते|से)\s*(\d{1,2})\b/.exec(user);
			if (h && /open|उघड|खुल/i.test(user)) {
				const pad = (n: number) => `${String(n).padStart(2, '0')}:00`;
				const close = Number(h[2]) < 12 ? Number(h[2]) + 12 : Number(h[2]);
				out.hours = [{ days: [0, 1, 2, 3, 4, 5, 6], opens: pad(Number(h[1])), closes: pad(close) }];
			}
			return { content: JSON.stringify(out), tool_calls: [] };
		}
		// P12 trip report summary: facts only from the JSON it is given.
		if (sys.startsWith('Write a 2–3 sentence summary of this trip')) {
			const f = JSON.parse(user) as { title: string; days: unknown[] };
			return { content: `Mock summary: ${f.title}, ${f.days.length} day(s).`, tool_calls: [] };
		}
		if (sys.startsWith("You are Crabby replying in a trip's group chat")) {
			const block = req.messages.at(-1)?.content ?? '';
			const veg = /"veg":(\d+)/.exec(block)?.[1];
			const names = [...block.matchAll(/"name":"([^"]+)"/g)].map((x) => x[1]);
			const say = block.includes('POLL POSTED')
				? "I've posted a poll — vote below!"
				: block.includes('PROPOSED: ')
					? 'a plan change is ready — any editor can apply it below.'
					: names.length
						? [...new Set(names)].slice(0, 3).join(', ')
						: "I don't know that.";
			return {
				content: `Mock (group): ${say}${veg ? ` (${veg} of you veg)` : ''}`,
				tool_calls: []
			};
		}

		if (req.tools?.length) {
			const done = req.messages.filter(
				(m) => m.role === 'assistant' && m.tool_calls?.length
			).length;
			const plan: ToolCall[][] = [];
			// P12 drive: show / open / filter / switch sections; add-to-trip previews.
			const listing = /(seed-[a-z0-9-]+)/.exec(text)?.[1];
			const day = (n: number) =>
				new Date(Date.now() + (5.5 + 24 * n) * 3600e3).toISOString().slice(0, 10);
			// P12 books the unbookable: "is <stay slug> free" → a request preview.
			if (text.includes(' free') && listing?.startsWith('seed-stay'))
				plan.push([
					call('request_stay', {
						type: 'stay',
						slug: listing,
						check_in: day(7),
						check_out: day(9),
						guests: 2,
						budget: 2500
					})
				]);
			else if (text.includes('admin'))
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
		// P12 at the spot: answer from the scanned place's facts and today's trip.
		const at = /"tool":"at_the_spot","result":\{"place":"([^"]+)"/.exec(block)?.[1];
		if (at) {
			const next = /"next":\["([^"]+)"/.exec(block)?.[1];
			return {
				content:
					/next on my trip|आगे|पुढे/.test(text) && next
						? `Mock: next on your trip: ${next}.`
						: `Mock: you're at ${at}.`,
				tool_calls: []
			};
		}
		// P12 Ask our team: a stored team answer is reused; nothing known → offer to ask.
		const team =
			/"tool":"team_answers","result":\[\{[^}]*"answer":"([^"]+)","answered_on":"([^"]+)"/.exec(
				block
			);
		if (team) return { content: `Mock: our team says: ${team[1]} (${team[2]}).`, tool_calls: [] };
		if (/^PROPOSED PREVIEWS: ask_team$/m.test(block))
			return {
				content: "Mock: I don't know that yet — I can ask our team (usually within a day).",
				tool_calls: []
			};
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
