// Correction factors (G8, values from the correction_factors table — never hard-coded here).
export type Flag = 'ghat' | 'coastal';
export type Factors = { ghat: number; coastal: number; monsoon: number; monsoonMonths: number[] };

/**
 * Segment-weighted correction: each OSRM segment on a flagged way is scaled by the largest factor among its
 * flags (ghat and coastal are not stacked — DECISIONS P3-3); monsoon then scales the whole trip when `month`
 * (1–12) is active. Never returns less than the raw duration.
 */
export function correctedDuration(segments: number[], flags: (Set<Flag> | undefined)[], f: Factors, month: number) {
	let total = 0;
	segments.forEach((d, i) => {
		const s = flags[i];
		const m = s ? Math.max(1, s.has('ghat') ? f.ghat : 1, s.has('coastal') ? f.coastal : 1) : 1;
		total += d * m;
	});
	if (f.monsoonMonths.includes(month)) total *= f.monsoon;
	return Math.round(Math.max(total, segments.reduce((a, b) => a + b, 0)));
}

/** Ordered pairs (a→b, a≠b) — the matrix holds both directions. */
export const expectedPairs = (n: number) => n * (n - 1);

/** Key for an undirected OSM node pair. */
export const segKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
