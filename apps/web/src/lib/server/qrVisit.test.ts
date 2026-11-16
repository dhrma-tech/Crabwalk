import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/env/private', () => ({ RATE_LIMIT_SALT: 'test-salt' }));
vi.mock('./service.ts', () => ({ serviceClient: () => ({}) }));
const { checkVisit, signVisit, VISIT_TTL_S } = await import('./qrVisit.ts');

const NOW = 1_800_000_000_000;

describe('scan token for Verify visit (SEC-03)', () => {
	it('accepts a fresh token for the same code and scan session', async () => {
		const t = await signVisit('RTN-001', 'sid-1', NOW);
		expect(t).toMatch(/^RTN-001\.1800000000000\.[0-9a-f]{64}$/);
		expect(await checkVisit(t, 'RTN-001', 'sid-1', NOW + 60_000)).toBe(true);
	});
	it('refuses another code, another session, a missing or edited token', async () => {
		const t = await signVisit('RTN-001', 'sid-1', NOW);
		const flipped = t.slice(0, -1) + (t.endsWith('0') ? '1' : '0');
		expect(await checkVisit(t, 'RTN-002', 'sid-1', NOW)).toBe(false);
		expect(await checkVisit(t, 'RTN-001', 'sid-2', NOW)).toBe(false);
		expect(await checkVisit(undefined, 'RTN-001', 'sid-1', NOW)).toBe(false);
		expect(await checkVisit(t, 'RTN-001', undefined, NOW)).toBe(false);
		expect(await checkVisit(t.replace('RTN-001', 'RTN-002'), 'RTN-002', 'sid-1', NOW)).toBe(false);
		expect(await checkVisit(flipped, 'RTN-001', 'sid-1', NOW)).toBe(false);
		expect(await checkVisit(`${t}.x`, 'RTN-001', 'sid-1', NOW)).toBe(false);
	});
	it('expires after 30 minutes and refuses tokens from the future', async () => {
		const t = await signVisit('RTN-001', 'sid-1', NOW);
		expect(await checkVisit(t, 'RTN-001', 'sid-1', NOW + VISIT_TTL_S * 1000)).toBe(true);
		expect(await checkVisit(t, 'RTN-001', 'sid-1', NOW + VISIT_TTL_S * 1000 + 1)).toBe(false);
		expect(await checkVisit(t, 'RTN-001', 'sid-1', NOW - 1)).toBe(false);
	});
});
