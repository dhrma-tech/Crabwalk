// Optimistic verdict aggregate (hardening T1-05): the same rule as `app.refresh_verdict_agg` in the database —
// winner = most votes, a tie goes to the higher level; "New" below 10 votes. The server's numbers replace it as
// soon as `invalidate('app:ratings')` returns.
export type Agg = {
	counts: number[];
	total: number;
	winner_level: number | null;
	winner_pct: number | null;
	is_new: boolean;
};

/** `agg` after one voter moves from `prev` (or no vote) to `level`. */
export function withVote(agg: Agg | null, prev: number | undefined, level: number): Agg {
	const counts = [...(agg?.counts ?? [0, 0, 0, 0])];
	if (prev) counts[prev - 1] = Math.max(0, counts[prev - 1]! - 1);
	counts[level - 1]! += 1;
	const total = counts.reduce((a, b) => a + b, 0);
	const best = Math.max(...counts);
	const winner_level = counts.lastIndexOf(best) + 1;
	return { counts, total, winner_level, winner_pct: best / total, is_new: total < 10 };
}
