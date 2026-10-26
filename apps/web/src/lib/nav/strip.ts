import { decodePolyline, type LL } from './nav.ts';

// The plan view's mini route strip (Report 1 §4.4, T-32): one day's stored OSRM shapes, fitted into a small SVG.
// No basemap tiles — just the line, so it costs nothing and works offline.

export type StripLeg = {
	from: { at: LL | null };
	to: { at: LL; kind: string };
	shape: string | null;
};

/**
 * Paths (stored shape, or a straight guide when none is stored) and stop points in SVG units for a w × h box
 * with `pad` inside. Longitude is scaled by cos(latitude) so the shape keeps its proportions.
 */
export function stripGeometry(legs: StripLeg[], w: number, h: number, pad = 12) {
	const lines = legs.map((l) => ({
		guide: !l.shape,
		pts: l.shape ? decodePolyline(l.shape) : l.from.at ? [l.from.at, l.to.at] : [l.to.at]
	}));
	// Fit the day's stops and the legs between them; the first leg (from the start, often a long drive from a
	// station) only counts when the day has a single stop, else it may run off the edge (the SVG clips it).
	const fit = legs.length > 1 ? lines.slice(1) : lines;
	const all = [...fit.flatMap((l) => l.pts), ...legs.map((l) => l.to.at)];
	if (!all.length) return null;
	const lat0 = all.reduce((s, p) => s + p[1], 0) / all.length;
	const k = Math.cos((lat0 * Math.PI) / 180);
	const xs = all.map((p) => p[0] * k);
	const ys = all.map((p) => p[1]);
	const [minX, maxX, minY, maxY] = [
		Math.min(...xs),
		Math.max(...xs),
		Math.min(...ys),
		Math.max(...ys)
	];
	const span = Math.max(maxX - minX, (maxY - minY) * ((w - 2 * pad) / (h - 2 * pad)), 1e-6);
	const scale = (w - 2 * pad) / span;
	const ox = (w - (maxX - minX) * scale) / 2;
	const oy = (h - (maxY - minY) * scale) / 2;
	const xy = (p: LL): [number, number] => [
		Math.round((ox + (p[0] * k - minX) * scale) * 10) / 10,
		Math.round((h - oy - (p[1] - minY) * scale) * 10) / 10
	];
	return {
		paths: lines
			.filter((l) => l.pts.length > 1)
			.map((l) => ({ guide: l.guide, d: 'M' + l.pts.map((p) => xy(p).join(' ')).join('L') })),
		start: legs[0]?.from.at ? xy(legs[0].from.at) : null,
		stops: legs.map((l) => ({ kind: l.to.kind, at: xy(l.to.at) }))
	};
}
