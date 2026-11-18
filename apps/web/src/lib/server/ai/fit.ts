// Hardening T2-01 (AI-05): tool results for the model as JSON that is always valid and ≤ maxChars. A plain
// `.slice()` cuts mid-token and hands the model broken JSON. Order: shorten long text fields (story, history,
// description, transcript); then cut arrays to the longest prefix that fits plus a trailing `{"truncated": n}`;
// then shorten every string; last resort `{"truncated":true}`.
type J = null | boolean | number | string | J[] | { [k: string]: J };
type Slot = [holder: Record<string, J>, key: string, text: string];

const LONG = new Set(['story', 'history', 'description', 'transcript']);
const size = (v: J) => JSON.stringify(v).length;

/** String slots in the tree (array items count with their index as key). */
function strings(v: J, onlyLong: boolean, out: Slot[] = []): Slot[] {
	if (v && typeof v === 'object')
		for (const [k, x] of Object.entries(v)) {
			if (typeof x !== 'string') strings(x, onlyLong, out);
			else if (!onlyLong || (!Array.isArray(v) && LONG.has(k)))
				out.push([v as Record<string, J>, k, x]);
		}
	return out;
}

/** Applies the largest per-field cap that makes `root` fit. False (nothing kept) when even an empty cap fails. */
function capStrings(root: J, slots: Slot[], max: number) {
	if (!slots.length) return false;
	const set = (cap: number) => {
		for (const [h, k, s] of slots) h[k] = s.length > cap ? `${s.slice(0, cap)}…` : s;
	};
	set(0);
	if (size(root) > max) return false;
	let lo = 0;
	let hi = Math.max(...slots.map(([, , s]) => s.length));
	while (lo < hi) {
		const mid = Math.ceil((lo + hi) / 2);
		set(mid);
		if (size(root) <= max) lo = mid;
		else hi = mid - 1;
	}
	set(lo);
	return true;
}

function arrays(v: J, out: J[][] = []): J[][] {
	if (Array.isArray(v)) out.push(v);
	if (v && typeof v === 'object') Object.values(v).forEach((x) => arrays(x, out));
	return out;
}

export function fit(value: unknown, maxChars: number): string {
	const whole = JSON.stringify(value ?? null) ?? 'null';
	if (whole.length <= maxChars) return whole;
	const root = JSON.parse(whole) as J;

	if (capStrings(root, strings(root, true), maxChars)) return JSON.stringify(root);

	// Arrays: start at the largest, step into a child array that holds most of it (one big tool result), cut
	// once. If the whole still does not fit with that array emptied, go on to the next one.
	const done = new Set<J[]>();
	for (;;) {
		const open = (v: J) => arrays(v).filter((a) => a.length && !done.has(a));
		const all = open(root);
		if (!all.length) break;
		let a = all.reduce((x, y) => (size(y) > size(x) ? y : x));
		for (let inner; (inner = open(a).find((b) => b !== a && size(b) * 2 > size(a)));) a = inner;
		done.add(a);
		const items = [...a];
		const cut = (k: number) =>
			a.splice(0, a.length, ...items.slice(0, k), { truncated: items.length - k });
		cut(0);
		if (size(root) > maxChars) continue;
		let lo = 0;
		let hi = items.length - 1;
		while (lo < hi) {
			const mid = Math.ceil((lo + hi) / 2);
			cut(mid);
			if (size(root) <= maxChars) lo = mid;
			else hi = mid - 1;
		}
		cut(lo);
		return JSON.stringify(root);
	}

	if (capStrings(root, strings(root, false), maxChars)) return JSON.stringify(root);
	const last = '{"truncated":true}';
	return last.length <= maxChars ? last : 'null';
}
