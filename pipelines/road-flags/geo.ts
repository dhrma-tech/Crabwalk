// OPL parsing + coastline proximity, kept separate so they can be unit-tested.
export type Node = { id: number; lon: number; lat: number };
export type Way = { id: number; tags: Record<string, string>; nodes: Node[] };

// OPL escapes: %<hex>% for special chars.
const unescape = (s: string) => s.replace(/%([0-9a-f]+)%/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));

/** Parse `osmium cat -f opl` way lines (with add-locations-to-ways: N<id>x<lon>y<lat>,...). */
export function parseOplWays(opl: string): Way[] {
	const ways: Way[] = [];
	for (const line of opl.split('\n')) {
		if (!line.startsWith('w')) continue;
		const fields = line.split(' ');
		const id = Number(fields[0].slice(1));
		const t = fields.find((f) => f.startsWith('T'))?.slice(1) ?? '';
		const n = fields.find((f) => f.startsWith('N'))?.slice(1) ?? '';
		const tags = Object.fromEntries(
			t ? t.split(',').map((kv) => kv.split('=').map(unescape) as [string, string]) : []
		);
		const nodes = n
			? n.split(',').map((ref) => {
					const m = ref.match(/^n(-?\d+)(?:x(-?[\d.]+)y(-?[\d.]+))?$/);
					return { id: Number(m?.[1]), lon: Number(m?.[2] ?? NaN), lat: Number(m?.[3] ?? NaN) };
				})
			: [];
		ways.push({ id, tags, nodes });
	}
	return ways;
}

const KM_PER_DEG = 111.32;

/** Returns a predicate: is (lon,lat) within `km` of any coastline segment? Grid-indexed. */
export function coastIndex(coast: Way[], km: number) {
	const cell = km / KM_PER_DEG; // grid cell ≈ km
	const grid = new Map<string, [number, number, number, number][]>();
	const key = (x: number, y: number) => `${Math.floor(x / cell)}:${Math.floor(y / cell)}`;
	for (const w of coast)
		for (let i = 1; i < w.nodes.length; i++) {
			const a = w.nodes[i - 1], b = w.nodes[i];
			const seg: [number, number, number, number] = [a.lon, a.lat, b.lon, b.lat];
			for (const p of [a, b]) {
				const k = key(p.lon, p.lat);
				(grid.get(k) ?? grid.set(k, []).get(k)!).push(seg);
			}
		}
	return (lon: number, lat: number) => {
		if (!Number.isFinite(lon) || !Number.isFinite(lat)) return false;
		const cx = Math.floor(lon / cell), cy = Math.floor(lat / cell);
		const cos = Math.cos((lat * Math.PI) / 180);
		for (let dx = -2; dx <= 2; dx++)
			for (let dy = -2; dy <= 2; dy++)
				for (const [x1, y1, x2, y2] of grid.get(`${cx + dx}:${cy + dy}`) ?? [])
					if (distKm(lon, lat, x1, y1, x2, y2, cos) <= km) return true;
		return false;
	};
}

// Point–segment distance on a local equirectangular projection (fine at km scale).
function distKm(px: number, py: number, x1: number, y1: number, x2: number, y2: number, cos: number) {
	const ax = (x1 - px) * cos, ay = y1 - py, bx = (x2 - px) * cos, by = y2 - py;
	const dx = bx - ax, dy = by - ay;
	const t = dx || dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0;
	return Math.hypot(ax + t * dx, ay + t * dy) * KM_PER_DEG;
}
