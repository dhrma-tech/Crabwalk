import { describe, expect, it } from 'vitest';
import { byMonsoon, monsoonMode } from './prefs.ts';

describe('monsoon mode (hardening T3-03)', () => {
	const ist = (iso: string) => Date.parse(`${iso}T00:00:00+05:30`);
	it('is on from June to September by the IST date, unless the cookie says otherwise', () => {
		expect(monsoonMode(undefined, ist('2026-05-31'))).toBe(false);
		expect(monsoonMode(undefined, ist('2026-06-01'))).toBe(true);
		expect(monsoonMode(undefined, ist('2026-09-30'))).toBe(true);
		expect(monsoonMode(undefined, ist('2026-10-01'))).toBe(false);
		expect(monsoonMode('off', ist('2026-07-15'))).toBe(false);
		expect(monsoonMode('on', ist('2026-01-15'))).toBe(true);
		expect(monsoonMode('maybe', ist('2026-01-15'))).toBe(false);
	});
	it('orders closures first, then risky, keeping the list order within each group; nothing is dropped', () => {
		const rows = [
			{ id: 'a', monsoon: 'open' as const },
			{ id: 'b', monsoon: 'risky' as const },
			{ id: 'c', monsoon: 'closed' as const },
			{ id: 'd', monsoon: 'open' as const },
			{ id: 'e', monsoon: 'closed' as const }
		];
		expect(byMonsoon(rows).map((r) => r.id)).toEqual(['c', 'e', 'b', 'a', 'd']);
	});
});
