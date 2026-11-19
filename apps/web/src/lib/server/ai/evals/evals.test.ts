// T2-07: the structural eval cases (E1, C1, C2, P3, S1, S3) on the mock provider with a stub database. The
// runner (scripts/ai-eval.ts) runs these and the database-backed cases against the local stack.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/db.types.ts';
import { setBudget } from '../router.ts';
import { CASES } from './cases.ts';
import { runCase } from './harness.ts';

vi.mock('$app/env/private', async (orig) => ({
	...((await orig()) as object),
	AI_PROVIDER: 'mock'
}));

const ROWS: Record<string, unknown[]> = {
	places: [
		{
			slug: 'stub-fort',
			category: 'fort',
			is_hidden_gem: false,
			monsoon_status: 'open',
			place_translations: [{ lang: 'en', name: 'Stub Fort' }],
			talukas: { name_en: 'Stub' }
		}
	]
};

/** Every query builder call chains; awaiting gives the table's rows; single() gives an id, maybeSingle() nothing. */
function stubDb(capReached: boolean) {
	const builder = (table: string): unknown =>
		new Proxy(() => {}, {
			get(_t, prop) {
				if (prop === 'then')
					return (ok: (v: unknown) => void) => ok({ data: ROWS[table] ?? [], error: null });
				if (prop === 'single') return async () => ({ data: { id: 'stub-id' }, error: null });
				if (prop === 'maybeSingle') return async () => ({ data: null, error: null });
				return () => builder(table);
			}
		});
	return {
		from: (table: string) => builder(table),
		rpc: async (name: string) =>
			name === 'ai_take_message'
				? capReached
					? { data: null, error: { code: 'CW429', message: 'daily cap reached' } }
					: { data: 10, error: null }
				: { data: [], error: null }
	} as unknown as SupabaseClient<Database>;
}

const STRUCTURAL_CHAT = ['E1', 'C1', 'C2', 'P3', 'S1', 'S3'];

describe('eval set, structural cases on the mock (AI Spec 5.7)', () => {
	beforeAll(() => setBudget(async () => true));
	afterAll(() => setBudget(undefined));

	it('lists every case of the spec once', () => {
		expect(CASES.map((c) => c.id).sort()).toEqual(
			[
				...['G1', 'G2', 'G3', 'G4', 'G5', 'G6'],
				...['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
				...['V1', 'V2', 'V3', 'V4', 'V5'],
				...['L1', 'L2', 'L3', 'L4'],
				...['S1', 'S2', 'S3', 'S4', 'S5', 'S6'],
				'E1',
				'C1',
				'C2'
			].sort()
		);
	});

	it.each(STRUCTURAL_CHAT)('%s passes', async (id) => {
		const c = CASES.find((x) => x.id === id)!;
		expect(c.structural).toBe(true);
		const seen = await runCase(c, { db: stubDb(c.setup === 'cap'), userId: 'stub-user' });
		expect(c.check(seen)).toBeNull();
	});
});
