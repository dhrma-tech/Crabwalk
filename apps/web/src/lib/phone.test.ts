import { describe, expect, it } from 'vitest';
import { intl, telHref, waHref } from './phone.ts';

describe('phone links', () => {
	it('adds +91 to the forms 10-digit numbers (mobile and landline)', () => {
		expect(telHref('9503635969')).toBe('tel:+919503635969');
		expect(telHref('2355352503')).toBe('tel:+912355352503');
		expect(waHref('9503635969')).toBe('https://wa.me/919503635969');
	});
	it('keeps numbers already in international or trunk form working', () => {
		expect(intl('+91 95036 35969')).toBe('919503635969');
		expect(intl('02352 222363')).toBe('912352222363');
		expect(telHref('112')).toBe('tel:112');
	});
});
