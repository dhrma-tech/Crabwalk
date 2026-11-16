import { describe, expect, it } from 'vitest';
import { clientKey, ruleFor } from './rate.ts';

const u = (p: string) => new URL(`https://x.test${p}`);

describe('rate-limit rules (P10)', () => {
	it('covers anon and costly write endpoints', () => {
		expect(ruleFor('POST', u('/api/reports'))?.name).toBe('report');
		expect(ruleFor('POST', u('/q/RTN-001/report'))?.name).toBe('report');
		expect(ruleFor('POST', u('/q/RTN-001/scan'))?.name).toBe('qr-scan');
		expect(ruleFor('POST', u('/api/trips/abc/chat'))?.name).toBe('chat');
		expect(ruleFor('POST', u('/api/trips/abc/chat/def/vote'))?.name).toBe('chat');
		expect(ruleFor('POST', u('/api/trips/plan'))?.name).toBe('plan');
		expect(ruleFor('POST', u('/api/ai/chat'))?.name).toBe('ai');
		expect(ruleFor('POST', u('/login?/sendCode'))?.name).toBe('login-code');
	});
	it('keys clients by the platform address only: a spoofed cf-connecting-ip changes nothing (SEC-06)', async () => {
		const ev = (addr: string, spoof?: string) => ({
			request: new Request('https://x.test/', {
				headers: spoof ? { 'cf-connecting-ip': spoof } : {}
			}),
			getClientAddress: () => addr
		});
		const real = await clientKey(ev('198.51.100.7'), 'report');
		expect(real).toMatch(/^[0-9a-f]{64}$/);
		expect(await clientKey(ev('198.51.100.7', '203.0.113.99'), 'report')).toBe(real);
		expect(await clientKey(ev('198.51.100.8'), 'report')).not.toBe(real);
		expect(await clientKey(ev('198.51.100.7'), 'ai')).not.toBe(real);
	});
	it('leaves reads, sign-out and Google sign-in alone', () => {
		expect(ruleFor('GET', u('/api/reports'))).toBeUndefined();
		expect(ruleFor('GET', u('/q/RTN-001'))).toBeUndefined();
		expect(ruleFor('POST', u('/login?/signOut'))).toBeUndefined();
		expect(ruleFor('POST', u('/login?/google'))).toBeUndefined();
	});
});
