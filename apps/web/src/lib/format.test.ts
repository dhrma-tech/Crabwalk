import { describe, expect, it } from 'vitest';
import { formatDate, formatINR, formatINRRange, formatNumber, menuLine } from './format.ts';

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

describe('menuLine', () => {
	it('splits a trailing rupee price for the dot leader', () => {
		expect(menuLine('Fish thali – ₹250')).toEqual({ name: 'Fish thali', price: '₹250' });
		expect(menuLine('Solkadhi ₹ 40')).toEqual({ name: 'Solkadhi', price: '₹40' });
		expect(menuLine('Kombdi vade: ₹1,200')).toEqual({ name: 'Kombdi vade', price: '₹1,200' });
	});
	it('leaves other lines whole', () => {
		expect(menuLine('Ukadiche modak (Sundays)')).toEqual({
			name: 'Ukadiche modak (Sundays)',
			price: null
		});
		expect(menuLine('Thali 250')).toEqual({ name: 'Thali 250', price: null });
		expect(menuLine('₹250')).toEqual({ name: '₹250', price: null });
	});
});
