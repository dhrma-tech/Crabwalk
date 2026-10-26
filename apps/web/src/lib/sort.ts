// List sort for Stays and Food (DECISIONS T-27). `?sort=` in the URL; unknown values fall back to the default.

export const SORTS = ['best', 'price_asc', 'price_desc'] as const;
export type Sort = (typeof SORTS)[number];
export const readSort = (v: string | null): Sort =>
	SORTS.includes(v as Sort) ? (v as Sort) : 'best';

type Agg = { counts: number[]; total: number; is_new: boolean } | null;

/**
 * best: rated listings first, by the share of the top two verdicts, then by votes; then "new" ones (few votes)
 * by votes; then unrated. price_*: by price, listings without a price last. Ties keep the name order.
 */
export function sortListings<T extends { agg: Agg; name: string }>(
	items: T[],
	sort: Sort,
	price: (t: T) => { low: number | null; high: number | null }
): T[] {
	const tier = (a: Agg) => (!a?.total ? 2 : a.is_new ? 1 : 0);
	const top = (a: Agg) => (a?.total ? ((a.counts[2] ?? 0) + (a.counts[3] ?? 0)) / a.total : 0);
	const byName = (a: T, b: T) => a.name.localeCompare(b.name);
	const cmp: Record<Sort, (a: T, b: T) => number> = {
		best: (a, b) =>
			tier(a.agg) - tier(b.agg) ||
			top(b.agg) - top(a.agg) ||
			(b.agg?.total ?? 0) - (a.agg?.total ?? 0) ||
			byName(a, b),
		price_asc: (a, b) => {
			const [x, y] = [price(a).low, price(b).low];
			return (x == null ? 1 : 0) - (y == null ? 1 : 0) || (x ?? 0) - (y ?? 0) || byName(a, b);
		},
		price_desc: (a, b) => {
			const [x, y] = [price(a).high ?? price(a).low, price(b).high ?? price(b).low];
			return (x == null ? 1 : 0) - (y == null ? 1 : 0) || (y ?? 0) - (x ?? 0) || byName(a, b);
		}
	};
	return [...items].sort(cmp[sort]);
}
