// Hardening T3-05: the tool registry and each tool's guard paths, table-driven, on a stub database (no rows).
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/db.types.ts';
import { runTool, TOOL_DEFS, TOOLS, type Ctx } from './tools.ts';

/** Every query chains; awaiting gives no rows; single() an id; maybeSingle() nothing; rpc() no rows. */
function stubDb() {
	const builder = (): unknown =>
		new Proxy(() => {}, {
			get(_t, prop) {
				if (prop === 'then') return (ok: (v: unknown) => void) => ok({ data: [], error: null });
				if (prop === 'single') return async () => ({ data: { id: 'stub-id' }, error: null });
				if (prop === 'maybeSingle') return async () => ({ data: null, error: null });
				return () => builder();
			}
		});
	return {
		from: () => builder(),
		rpc: async () => ({ data: [], error: null })
	} as unknown as SupabaseClient<Database>;
}
const ctx = (path: string | null = null): Ctx => ({
	db: stubDb(),
	userId: 'stub-user',
	lang: 'en',
	trips: new Map(),
	proposed: [],
	drive: [],
	path,
	questions: null,
	profile: null
});

describe('tool registry (T3-05)', () => {
	it('lists every tool once, in the order the model has always seen', () => {
		expect(TOOL_DEFS.map((d) => d.name)).toEqual([
			'search_places',
			'find_places',
			'get_place',
			'search_stays',
			'search_eateries',
			'get_dish',
			'nearby',
			'get_conditions',
			'list_my_trips',
			'build_plan',
			'edit_plan',
			'propose_action',
			'drive',
			'request_stay',
			'ask_team',
			'ask_user'
		]);
	});
	it.each(TOOLS.map((t) => [t.def.name, t] as const))(
		'%s has a description, an object schema and run()',
		(_, t) => {
			expect(t.def.description.length).toBeGreaterThan(20);
			expect(t.def.parameters).toMatchObject({ type: 'object' });
			expect(typeof t.run).toBe('function');
		}
	);
});

describe('runTool guards (table)', () => {
	it.each([
		['search_places', '{not json', { error: 'arguments were not valid JSON' }],
		['no_such_tool', '{}', { error: 'unknown tool no_such_tool' }],
		['search_places', '{}', []],
		['find_places', '{"categories":["beach"],"crowd":"calm"}', []],
		['search_stays', '{"max_price":2000}', []],
		['search_eateries', '{"diet":"veg"}', []],
		['list_my_trips', '{}', []],
		['get_place', '{"slug":"nowhere"}', { found: false }],
		['get_dish', '{"slug":"nothing"}', { found: false }],
		['nearby', '{"slug":"nowhere"}', { found: false }],
		['get_conditions', '{"slug":"nowhere"}', { found: false }],
		[
			'edit_plan',
			'{"trip":"T9","ops":[]}',
			{ error: 'unknown trip ref — call list_my_trips first' }
		],
		['propose_action', '{"type":"teleport"}', { error: 'unknown action type' }],
		[
			'propose_action',
			'{"type":"save_share","trip":"T9"}',
			{ error: 'unknown trip ref — call list_my_trips first' }
		],
		[
			'request_stay',
			'{"type":"stay","slug":"x"}',
			{ error: 'missing or bad dates / guests — ask the user' }
		],
		['ask_team', '{"question":"hi"}', { error: 'empty question' }],
		[
			'ask_user',
			'{"questions":[]}',
			{ error: 'bad question card: 1–4 questions, 2–4 options each' }
		]
	])('%s %s', async (name, args, want) => {
		expect(await runTool(ctx(), name, args)).toEqual(want);
	});

	it('build_plan with nothing known asks instead of planning', async () => {
		const c = ctx();
		const r = (await runTool(c, 'build_plan', '{}')) as { asked_user: string[] };
		expect(r.asked_user.length).toBeGreaterThan(0);
		expect(c.questions?.length).toBe(r.asked_user.length);
		expect(c.proposed).toEqual([]);
	});

	it('drive runs allowed steps and refuses the rest', async () => {
		const c = ctx('/');
		const r = await runTool(
			c,
			'drive',
			JSON.stringify({
				steps: [
					{ action: 'openPage', page: 'admin' },
					{ action: 'openPage', page: 'map' },
					{ action: 'switchTab', section: 'expenses' }
				]
			})
		);
		expect(r).toMatchObject({
			doing: ['openPage'],
			refused: ['openPage: not allowed', 'switchTab: no trip is open']
		});
		expect(c.drive).toEqual([{ action: 'openPage', page: 'map' }]);
	});
});
