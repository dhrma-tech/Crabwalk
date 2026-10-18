import { expect, it } from 'vitest';
import { difficulty } from './difficulty.ts';

it('maps sac_scale to the 3-level scale (P9-1)', () => {
	expect(difficulty('hiking')).toBe('easy');
	expect(difficulty('mountain_hiking')).toBe('moderate');
	expect(difficulty('demanding_mountain_hiking')).toBe('hard');
	expect(difficulty('alpine_hiking')).toBe('hard');
	expect(difficulty(undefined)).toBeNull();
	expect(difficulty('something_else')).toBeNull();
});
