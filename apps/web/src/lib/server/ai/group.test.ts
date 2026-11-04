import { describe, expect, it } from 'vitest';
import { MOMENT, TAG } from './group.ts';

// P12 step G: when Crabby looks at a group message at all (before any model call).
describe('group chat triggers', () => {
	it('a tag is "@Crabby" anywhere or "Crabby," first', () => {
		expect(TAG.test('@Crabby which beach?')).toBe(true);
		expect(TAG.test('crabby, plan day 2')).toBe(true);
		expect(TAG.test('the crabbywalk app')).toBe(false);
		expect(TAG.test('ask crabby later')).toBe(false);
	});

	it('planning moments in EN / HI / MR; small talk is not one', () => {
		for (const t of ['where should we eat?', 'budget is tight', 'कल कहाँ चलें', 'जेवण कुठे करूया'])
			expect(MOMENT.test(t), t).toBe(true);
		for (const t of ['haha nice', 'good morning', 'ok 👍']) expect(MOMENT.test(t), t).toBe(false);
	});
});
