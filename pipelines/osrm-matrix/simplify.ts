// Douglas–Peucker on [lon, lat] with a tolerance in metres (A4: ~10 m), local equirectangular projection.
export function simplify(pts: [number, number][], toleranceM: number): [number, number][] {
	if (pts.length < 3) return pts;
	const lat0 = (pts[0][1] * Math.PI) / 180;
	const mx = 111_320 * Math.cos(lat0), my = 110_540;
	const xy = pts.map(([lon, lat]) => [lon * mx, lat * my]);
	const keep = new Uint8Array(pts.length);
	keep[0] = keep[pts.length - 1] = 1;
	const stack: [number, number][] = [[0, pts.length - 1]];
	while (stack.length) {
		const [s, e] = stack.pop()!;
		const [x1, y1] = xy[s], [x2, y2] = xy[e];
		const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
		let max = 0, idx = -1;
		for (let i = s + 1; i < e; i++) {
			const d = Math.abs(dy * xy[i][0] - dx * xy[i][1] + x2 * y1 - y2 * x1) / len;
			if (d > max) (max = d), (idx = i);
		}
		if (max > toleranceM && idx > 0) {
			keep[idx] = 1;
			stack.push([s, idx], [idx, e]);
		}
	}
	return pts.filter((_, i) => keep[i]);
}
