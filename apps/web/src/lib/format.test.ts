import { describe, expect, it } from 'vitest';
import { formatDate, formatINR, formatINRRange, formatNumber } from './format.ts';

describe('Indian number formatting', () => {
	it('groups lakhs in every locale', () => {
		expect(formatINR(125000, 'en')).toBe('₹1,25,000');
		expect(formatINR(125000, 'hi')).toBe('₹1,25,000');
		expect(formatINR(125000, 'mr')).toBe('₹१,२५,०००');
	});
	it('formats price ranges and numbers', () => {
		expect(formatINRRange(1800, 2500, 'en')).toBe('₹1,800–2,500');
		expect(formatNumber(2.45, 'en')).toBe('2.5');
	});
	it('formats verified dates', () => {
		expect(formatDate('2026-10-03', 'en')).toBe('3 Oct 2026');
	});
});
