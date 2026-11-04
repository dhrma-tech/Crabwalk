// Trip spends and balances (docs/P11 Plan workspace.md §5). Whole rupees throughout; tracking only, no payments.

export type Share = { member_id: string; amount: number };
export type Spend = { paid_by: string; shares: Share[] };

/** Equal split in whole rupees: the remainder goes to the first tripmates (as stored, migration P11). */
export function equalShares(amount: number, members: string[]): Share[] {
	if (!members.length) return [];
	const each = Math.floor(amount / members.length);
	const extra = amount - each * members.length;
	return members.map((member_id, i) => ({ member_id, amount: each + (i < extra ? 1 : 0) }));
}

/** Net per tripmate: paid minus owed (positive = gets money back). Every tripmate appears, in order. */
export function balances(members: string[], spends: Spend[]) {
	const net = new Map(members.map((m) => [m, 0]));
	for (const s of spends) {
		net.set(s.paid_by, (net.get(s.paid_by) ?? 0) + s.shares.reduce((t, x) => t + x.amount, 0));
		for (const x of s.shares) net.set(x.member_id, (net.get(x.member_id) ?? 0) - x.amount);
	}
	return net;
}

/** "A pays B ₹x": the biggest debtor pays the biggest creditor until everyone is square (greedy). */
export function settle(net: Map<string, number>) {
	const owe = [...net].filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
	const get = [...net].filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
	const out: { from: string; to: string; amount: number }[] = [];
	const big = (a: { v: number }, b: { v: number }) => b.v - a.v;
	while (owe.length && get.length) {
		owe.sort(big);
		get.sort(big);
		const d = owe[0]!;
		const c = get[0]!;
		const amount = Math.min(d.v, c.v);
		out.push({ from: d.id, to: c.id, amount });
		d.v -= amount;
		c.v -= amount;
		if (!d.v) owe.shift();
		if (!c.v) get.shift();
	}
	return out;
}
