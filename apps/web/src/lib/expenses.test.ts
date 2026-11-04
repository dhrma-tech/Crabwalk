import { describe, expect, it } from 'vitest';
import { balances, equalShares, settle, type Spend } from './expenses.ts';

describe('equalShares', () => {
	it('splits whole rupees; the remainder goes to the first tripmates', () => {
		expect(equalShares(1000, ['a', 'b', 'c'])).toEqual([
			{ member_id: 'a', amount: 334 },
			{ member_id: 'b', amount: 333 },
			{ member_id: 'c', amount: 333 }
		]);
		expect(equalShares(10, ['a'])).toEqual([{ member_id: 'a', amount: 10 }]);
		expect(equalShares(10, [])).toEqual([]);
	});
});

describe('balances + settle (P11 step E: 3 tripmates, 4 spends)', () => {
	const members = ['asha', 'ravi', 'meera'];
	const spends: Spend[] = [
		// Stay ₹3,000 by Asha, split equally.
		{ paid_by: 'asha', shares: equalShares(3000, members) },
		// Fuel ₹1,200 by Ravi, split equally.
		{ paid_by: 'ravi', shares: equalShares(1200, members) },
		// Lunch ₹900 by Meera, custom: Asha 200, Ravi 300, Meera 400.
		{
			paid_by: 'meera',
			shares: [
				{ member_id: 'asha', amount: 200 },
				{ member_id: 'ravi', amount: 300 },
				{ member_id: 'meera', amount: 400 }
			]
		},
		// Fort entry ₹100 by Ravi for Asha and Meera only.
		{ paid_by: 'ravi', shares: equalShares(100, ['asha', 'meera']) }
	];

	it('nets paid minus owed per tripmate, summing to zero', () => {
		// Asha paid 3000, owes 1000 + 400 + 200 + 50 = 1650 → +1350.
		// Ravi paid 1300, owes 1000 + 400 + 300 = 1700 → −400.
		// Meera paid 900, owes 1000 + 400 + 400 + 50 = 1850 → −950.
		const b = balances(members, spends);
		expect(b).toEqual(
			new Map([
				['asha', 1350],
				['ravi', -400],
				['meera', -950]
			])
		);
		expect([...b.values()].reduce((s, x) => s + x, 0)).toBe(0);
	});

	it('settles with the fewest greedy payments', () => {
		expect(settle(balances(members, spends))).toEqual([
			{ from: 'meera', to: 'asha', amount: 950 },
			{ from: 'ravi', to: 'asha', amount: 400 }
		]);
	});

	it('nothing to settle when everyone is square', () => {
		expect(
			settle(balances(['a', 'b'], [{ paid_by: 'a', shares: [{ member_id: 'a', amount: 50 }] }]))
		).toEqual([]);
	});

	it('one debtor paying several creditors', () => {
		const b = new Map([
			['a', 300],
			['b', 200],
			['c', -500]
		]);
		expect(settle(b)).toEqual([
			{ from: 'c', to: 'a', amount: 300 },
			{ from: 'c', to: 'b', amount: 200 }
		]);
	});
});
