import { describe, expect, it } from 'vitest';
import { withVote } from './verdict.ts';

describe('withVote', () => {
	it('first vote on an empty listing', () => {
		expect(withVote(null, undefined, 3)).toEqual({
			counts: [0, 0, 1, 0],
			total: 1,
			winner_level: 3,
			winner_pct: 1,
			is_new: true
		});
	});

	it('a changed vote moves between levels; total stays; a tie goes to the higher level', () => {
		const agg = {
			counts: [0, 5, 6, 0],
			total: 11,
			winner_level: 3,
			winner_pct: 6 / 11,
			is_new: false
		};
		const r = withVote(agg, 3, 2);
		expect(r.counts).toEqual([0, 6, 5, 0]);
		expect(r.total).toBe(11);
		expect(r.winner_level).toBe(2);
		const tie = withVote({ ...agg, counts: [0, 5, 5, 0], total: 10 }, undefined, 4);
		expect(tie.counts).toEqual([0, 5, 5, 1]);
		expect(tie.winner_level).toBe(3);
		expect(tie.is_new).toBe(false);
	});
});
