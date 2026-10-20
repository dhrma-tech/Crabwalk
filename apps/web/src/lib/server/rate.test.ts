import { describe, expect, it } from 'vitest';
import { ruleFor } from './rate.ts';

const u = (p: string) => new URL(`https://x.test${p}`);

describe('rate-limit rules (P10)', () => {
	it('covers anon and costly write endpoints', () => {
		expect(ruleFor('POST', u('/api/reports'))?.name).toBe('report');
		expect(ruleFor('POST', u('/q/RTN-001/report'))?.name).toBe('report');
		expect(ruleFor('POST', u('/q/RTN-001/scan'))?.name).toBe('qr-scan');
		expect(ruleFor('POST', u('/api/trips/abc/vote'))?.name).toBe('vote');
		expect(ruleFor('POST', u('/plan/vote/0123abcd'))?.name).toBe('vote');
		expect(ruleFor('POST', u('/api/trips/plan'))?.name).toBe('plan');
		expect(ruleFor('POST', u('/api/ai/chat'))?.name).toBe('ai');
		expect(ruleFor('POST', u('/login?/sendCode'))?.name).toBe('login-code');
	});
	it('leaves reads, sign-out and Google sign-in alone', () => {
		expect(ruleFor('GET', u('/api/reports'))).toBeUndefined();
		expect(ruleFor('GET', u('/q/RTN-001'))).toBeUndefined();
		expect(ruleFor('POST', u('/login?/signOut'))).toBeUndefined();
		expect(ruleFor('POST', u('/login?/google'))).toBeUndefined();
	});
});
