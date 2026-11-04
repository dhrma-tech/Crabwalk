// Crabby in the trip's group chat (P12 step G, product plan 10.8; DECISIONS P12-1). Tagged ("@Crabby") → it
// always answers, on the tagger's daily cap. Untagged → it may speak at planning moments: a free keyword check
// first, then the group's cooldown and daily cap, then a small model decides — so most messages cost nothing.
// It sees the recent chat with names replaced by "Member n", the group's profile TOTALS (never one person's
// answers) and the trip's days; it answers from our tools only, can post a poll, and can propose a plan change
// that any editor applies from the chat.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/db.types.ts';
import { questionCard } from '#lib/questions.ts';
import type { Lang } from '../listings.ts';
import { istToday } from '../planner/data.ts';
import { describeStops } from '../planner/trips.ts';
import { postMessage } from '../chat/trip-chat.ts';
import { loadProfile } from '../profile.ts';
import { personaRules } from './persona.ts';
import type { Msg, ToolDef } from './providers.ts';
import { chain, route } from './router.ts';
import { runTool, TOOL_DEFS, type Ctx } from './tools.ts';

type DB = SupabaseClient<Database>;
const LANG_NAME: Record<Lang, string> = {
	en: 'English',
	hi: 'Hindi (Devanagari)',
	mr: 'Marathi (Devanagari)'
};

/** A planning moment worth a look: a question, dates, places, money, food, stays, or a disagreement. */
export const MOMENT =
	/\?|\b(which|where|when|budget|cost|stay|hotel|homestay|eat|food|lunch|dinner|plan|route|day|days|weekend|date|dates|instead|prefer|beach|fort|temple|waterfall)\b|कब|कहाँ|कौन|बजट|खाना|कुठे|कधी|कोणत|बजेट|जेवण/i;
/** "@Crabby" or "Crabby," at the start — a direct question to Crabby. */
export const TAG = /@crabby\b|^crabby\b[,:]?/i;

const GROUP_TOOLS = new Set([
	'search_places',
	'get_place',
	'search_stays',
	'search_eateries',
	'get_dish',
	'nearby',
	'get_conditions',
	'edit_plan',
	'propose_action'
]);
const ASK_GROUP: ToolDef = {
	name: 'ask_group',
	description:
		'Post a poll in the group chat when the group must choose (dates, which place or stay, budget) — 2–4 short options from what members said or tool results; multi=true if several can be picked.',
	parameters: {
		type: 'object',
		properties: {
			question: { type: 'string' },
			options: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'string' } },
			multi: { type: 'boolean' }
		},
		required: ['question', 'options']
	}
};

const DECIDE = `You decide whether Crabby, the trip's planning assistant, should speak in the group chat now.
Speak only at a real planning moment it can help with: dates, places, stays, food, budget, or a disagreement
between members. Not for small talk or when nobody needs help. Reply ONLY with JSON {"speak": true|false}.`;

const system = (
	lang: Lang,
	trip: string,
	totals: string
) => `You are Crabby, the planning assistant inside a trip's group chat
(Konkan coast, India). Members are anonymised as "Member n". Today is ${istToday()} (IST).
RULES — follow strictly:
- Use the tools for facts; state only facts from tool results or the TRIP below. Never invent timings, prices or places.
- Plan for the whole group: use the GROUP TOTALS to explain trade-offs ("2 of 4 like beaches, 1 is veg, so…").
  Never guess about one member.
- When the group has to choose, call ask_group to post a poll instead of choosing for them.
- To change the plan, call edit_plan (trip ref T1) or propose_action add_to_trip — it becomes a card any editor
  applies. Never claim something was changed.
- Never joke about safety. For emergencies tell them to call 112.
TRIP: ${trip}
GROUP TOTALS (from members' own profiles): ${totals}
Reply language: ${LANG_NAME[lang]}.`;

const explain = (
	lang: Lang,
	persona: 'playful' | 'plain'
) => `You are Crabby replying in a trip's group chat.
${personaRules(persona, lang)}
Write the reply in ${LANG_NAME[lang]}, under 90 words, to the whole group. Use ONLY facts in the TOOL RESULTS,
the TRIP and the GROUP TOTALS. If a poll was posted, invite everyone to vote. If a plan change was proposed,
say any editor can apply it below. If you don't know, say so in one sentence. No markdown tables.`;

async function tripSummary(db: DB, tripId: string, lang: Lang) {
	const { data: t } = await db
		.from('trips')
		.select('title, days, start_date, trip_stops(day, order, entity_type, entity_id)')
		.eq('id', tripId)
		.maybeSingle();
	if (!t) return null;
	const info = await describeStops(db, t.trip_stops, lang);
	const days = Array.from({ length: t.days }, (_, d) =>
		t.trip_stops
			.filter((s) => s.day === d + 1)
			.sort((a, b) => a.order - b.order)
			.map((s) => info.get(s.entity_id)?.name ?? '?')
			.join(' → ')
	);
	return `"${t.title}" (ref T1), ${t.days} day(s)${t.start_date ? ` from ${t.start_date}` : ''}. ${days
		.map((d, k) => `Day ${k + 1}: ${d || '(empty)'}`)
		.join('. ')}`;
}

/** The last 20 messages, names replaced by "Member n" (order they joined); Crabby as itself. */
async function transcript(db: DB, tripId: string) {
	const [{ data: msgs }, { data: mates }] = await Promise.all([
		db
			.from('trip_messages')
			.select('member_id, from_crabby, kind, body, payload')
			.eq('trip_id', tripId)
			.order('created_at', { ascending: false })
			.limit(20),
		db.from('trip_members').select('id').eq('trip_id', tripId).order('joined_at')
	]);
	const n = new Map((mates ?? []).map((m, k) => [m.id, `Member ${k + 1}`]));
	return (msgs ?? [])
		.reverse()
		.map((x) => {
			const who = x.from_crabby ? 'Crabby' : (n.get(x.member_id ?? '') ?? 'Member');
			const text =
				x.kind === 'poll'
					? `[poll] ${x.body} (${((x.payload as { options?: string[] })?.options ?? []).join(' / ')})`
					: x.kind === 'card'
						? `[shared ${(x.payload as { title?: string })?.title ?? 'card'}]`
						: (x.body ?? '');
			return `${who}: ${text.slice(0, 400)}`;
		})
		.join('\n');
}

/** Whether the group's unprompted budget (cap + cooldown) still allows a reply — checked before any LLM call. */
async function mayInterject(db: DB, tripId: string) {
	const [{ data: u }, { data: cfg }] = await Promise.all([
		db
			.from('crabby_group_usage')
			.select('proactive, last_spoke_at')
			.eq('trip_id', tripId)
			.eq('date', istToday())
			.maybeSingle(),
		db
			.from('app_config')
			.select('key, value')
			.in('key', ['crabby_group_daily', 'crabby_group_cooldown_s'])
	]);
	const c = new Map((cfg ?? []).map((r) => [r.key, Number(r.value)]));
	if (!u) return true;
	if (u.proactive >= (c.get('crabby_group_daily') ?? 10)) return false;
	return (
		!u.last_spoke_at ||
		Date.parse(u.last_spoke_at) < Date.now() - (c.get('crabby_group_cooldown_s') ?? 600) * 1000
	);
}

export async function crabbyInGroup(
	db: DB,
	userId: string,
	tripId: string,
	lang: Lang,
	text: string
): Promise<'replied' | 'quiet' | 'limit'> {
	const tagged = TAG.test(text);
	if (!tagged && (!MOMENT.test(text) || !(await mayInterject(db, tripId)))) return 'quiet';
	if (tagged) {
		const { error } = await db.rpc('ai_take_message');
		if (error) return 'limit';
	}
	const chat = await transcript(db, tripId);
	if (!tagged) {
		const d = await route(chain('intent'), {
			messages: [
				{ role: 'system', content: DECIDE },
				{ role: 'user', content: chat.slice(-3000) }
			],
			json: true,
			maxTokens: 20
		}).catch(() => null);
		if (!d || !/"speak"\s*:\s*true/.test(d.content)) return 'quiet';
	}

	const [trip, totals, profile] = await Promise.all([
		tripSummary(db, tripId, lang),
		db.rpc('trip_group_profile', { _trip: tripId }).then((r) => JSON.stringify(r.data ?? {})),
		loadProfile(db, userId)
	]);
	const ctx: Ctx = {
		db,
		userId,
		lang,
		trips: new Map([['T1', tripId]]),
		proposed: [],
		drive: [],
		path: null,
		questions: null,
		profile: null,
		group: true
	};
	const tools = [...TOOL_DEFS.filter((t) => GROUP_TOOLS.has(t.name)), ASK_GROUP];
	const convo: Msg[] = [
		{ role: 'system', content: system(lang, trip ?? '(unknown)', totals) },
		{ role: 'user', content: `Recent chat:\n${chat}` }
	];
	const results: { tool: string; result: unknown }[] = [];
	let poll: { question: string; options: string[]; multi: boolean } | null = null;
	for (let round = 0; round < 3; round++) {
		const r = await route(chain('intent'), { messages: convo, tools, maxTokens: 400 });
		if (!r.tool_calls.length) break;
		convo.push({ role: 'assistant', content: r.content, tool_calls: r.tool_calls });
		for (const call of r.tool_calls) {
			let result: unknown;
			if (call.name === 'ask_group') {
				const a = JSON.parse(call.args || '{}') as {
					question?: string;
					options?: string[];
					multi?: boolean;
				};
				const ok = questionCard.safeParse([
					{
						header: 'Poll',
						question: a.question ?? '',
						options: (a.options ?? []).map((label) => ({ label })),
						multi: a.multi
					}
				]);
				if (ok.success && !poll) {
					poll = {
						question: ok.data[0]!.question,
						options: ok.data[0]!.options.map((o) => o.label),
						multi: !!a.multi
					};
					result = { posted_poll: poll.question };
				} else result = { error: 'bad poll' };
			} else if (GROUP_TOOLS.has(call.name)) result = await runTool(ctx, call.name, call.args);
			else result = { error: 'not available in the group chat' };
			results.push({ tool: call.name, result });
			convo.push({
				role: 'tool',
				tool_call_id: call.id,
				content: JSON.stringify(result).slice(0, 6000)
			});
		}
	}

	const final = await route(chain('explain'), {
		messages: [
			{ role: 'system', content: explain(lang, profile?.persona ?? 'playful') },
			{ role: 'user', content: `Recent chat:\n${chat.slice(-2000)}` },
			{
				role: 'system',
				content: `TRIP: ${trip}\nGROUP TOTALS: ${totals}\nTOOL RESULTS:\n${results.length ? JSON.stringify(results).slice(0, 10000) : '(none)'}${poll ? `\nPOLL POSTED: ${poll.question}` : ''}${ctx.proposed.length ? `\nPROPOSED: ${ctx.proposed.map((p) => p.type).join(', ')}` : ''}`
			}
		],
		maxTokens: 300
	});
	try {
		await postMessage(db, tripId, {
			kind: 'text',
			body: final.content.trim().slice(0, 4000),
			crabby: true,
			proactive: !tagged
		});
	} catch (e) {
		if ((e as { code?: string }).code === 'CW429') return 'quiet'; // the group's cap or cooldown (race)
		throw e;
	}
	if (poll)
		await postMessage(db, tripId, {
			kind: 'poll',
			body: poll.question,
			payload: { options: poll.options, multi: poll.multi },
			crabby: true
		});
	for (const p of ctx.proposed)
		await postMessage(db, tripId, {
			kind: 'card',
			body: p.preview.title,
			payload: { action: p.type, title: p.preview.title, lines: p.preview.lines, data: p.payload },
			crabby: true
		});
	return 'replied';
}
