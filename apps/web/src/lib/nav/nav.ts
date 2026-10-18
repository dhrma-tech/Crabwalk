// In-browser navigation maths (PLAN P9 task 1): stored route line + compact turn cues (DECISIONS P9-2),
// GPS projected onto the line → next turn, distance left, ETA, off-route. Pure functions, offline.
export type LL = [number, number]; // [lon, lat]
export type Turn = { at: number; code: string };

/** Google/OSRM polyline (precision 5) → [lon, lat][] */
export function decodePolyline(s: string): LL[] {
	const out: LL[] = [];
	let i = 0;
	let lat = 0;
	let lon = 0;
	const next = () => {
		let r = 0;
		let shift = 0;
		let b: number;
		do {
			b = s.charCodeAt(i++) - 63;
			r |= (b & 0x1f) << shift;
			shift += 5;
		} while (b >= 0x20);
		return r & 1 ? ~(r >> 1) : r >> 1;
	};
	while (i < s.length) {
		lat += next();
		lon += next();
		out.push([lon / 1e5, lat / 1e5]);
	}
	return out;
}

export const decodeTurns = (s: string | null): Turn[] =>
	(s ?? '')
		.split(',')
		.filter(Boolean)
		.map((t) => {
			const m = /^(\d+)(.+)$/.exec(t)!;
			return { at: Number(m[1]), code: m[2]! };
		});

const R = 6371008.8;
export function metres(a: LL, b: LL) {
	const φ1 = (a[1] * Math.PI) / 180;
	const φ2 = (b[1] * Math.PI) / 180;
	const dφ = φ2 - φ1;
	const dλ = ((b[0] - a[0]) * Math.PI) / 180;
	const h = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(h));
}

/** Cumulative distance (m) at each vertex. */
export const cumulative = (line: LL[]) =>
	line.reduce<number[]>(
		(acc, p, i) => (acc.push(i ? acc[i - 1]! + metres(line[i - 1]!, p) : 0), acc),
		[]
	);

/** Project a GPS fix onto the line: distance along it and distance away from it (metres). */
export function project(line: LL[], cum: number[], p: LL) {
	let best = { along: 0, off: Infinity };
	const kx = Math.cos((p[1] * Math.PI) / 180) * 111320;
	const ky = 110540;
	for (let i = 0; i < line.length - 1; i++) {
		const [ax, ay] = [line[i]![0] * kx, line[i]![1] * ky];
		const [bx, by] = [line[i + 1]![0] * kx, line[i + 1]![1] * ky];
		const [px, py] = [p[0] * kx, p[1] * ky];
		const dx = bx - ax;
		const dy = by - ay;
		const len2 = dx * dx + dy * dy || 1;
		const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
		const off = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
		if (off < best.off) best = { along: cum[i]! + t * (cum[i + 1]! - cum[i]!), off };
	}
	return best;
}

export type NavState = {
	along: number;
	off: number;
	offRoute: boolean;
	left: number;
	next: { code: string; in: number } | null;
	etaMin: number | null;
};

export const OFF_ROUTE_M = 60;

export function navState(
	line: LL[],
	cum: number[],
	turns: Turn[],
	p: LL,
	durationS: number | null
): NavState {
	const { along, off } = project(line, cum, p);
	const total = cum.at(-1) ?? 0;
	const t = turns.find((x) => (cum[x.at] ?? 0) > along + 5);
	const left = Math.max(0, total - along);
	return {
		along,
		off,
		offRoute: off > OFF_ROUTE_M,
		left,
		next: t ? { code: t.code, in: (cum[t.at] ?? 0) - along } : null,
		etaMin: durationS && total ? Math.round(((left / total) * durationS) / 60) : null
	};
}
