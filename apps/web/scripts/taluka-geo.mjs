// Ratnagiri taluka map geometry (brief §7.2: real boundaries, not the reference's hand-drawn shapes).
// Source: OpenStreetMap relations 10354700–10354708 (admin_level 6), © OpenStreetMap contributors, ODbL.
// Fetch (any Overpass mirror):
//   [out:json];rel(id:10354700,10354701,10354702,10354703,10354704,10354705,10354706,10354707,10354708);out geom;
// Usage: node scripts/taluka-geo.mjs <overpass.json>  → src/lib/journal/content/talukaGeo.ts
// Each OSM way is simplified once (Douglas–Peucker, endpoints kept) and shared by both talukas it borders, so
// neighbours never gap. Ways used by one taluka only form the district outline (land border + coast).
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const src = process.argv[2];
if (!src) throw new Error('pass the Overpass JSON file');
const osm = JSON.parse(await readFile(src, 'utf8'));

const SLUG = (name) => name.replace(/ Taluka$/, '').toLowerCase();
const W = 600; // SVG width; height follows the district's aspect
const PAD = 8;
const TOL = 1; // px

const rels = osm.elements.filter((e) => e.type === 'relation');
const ways = new Map(); // id → [[lon, lat]]
const uses = new Map(); // way id → count of talukas using it
for (const r of rels)
	for (const m of r.members)
		if (m.type === 'way' && m.role !== 'inner' && m.geometry) {
			ways.set(
				m.ref,
				m.geometry.map((g) => [g.lon, g.lat])
			);
			uses.set(m.ref, (uses.get(m.ref) ?? 0) + 1);
		}

// Projection: equirectangular at the district's mid-latitude, fitted to W.
const all = [...ways.values()].flat();
const minLon = Math.min(...all.map((p) => p[0]));
const maxLon = Math.max(...all.map((p) => p[0]));
const minLat = Math.min(...all.map((p) => p[1]));
const maxLat = Math.max(...all.map((p) => p[1]));
const cos = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
const k = (W - 2 * PAD) / ((maxLon - minLon) * cos);
const H = Math.ceil((maxLat - minLat) * k + 2 * PAD);
const proj = ([lon, lat]) => [PAD + (lon - minLon) * cos * k, PAD + (maxLat - lat) * k];

function simplify(pts, tol) {
	if (pts.length < 3) return pts;
	const keep = new Uint8Array(pts.length);
	keep[0] = keep[pts.length - 1] = 1;
	const stack = [[0, pts.length - 1]];
	while (stack.length) {
		const [a, b] = stack.pop();
		const [ax, ay] = pts[a];
		const [bx, by] = pts[b];
		const len = Math.hypot(bx - ax, by - ay) || 1;
		let max = 0;
		let at = -1;
		for (let i = a + 1; i < b; i++) {
			const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / len;
			if (d > max) [max, at] = [d, i];
		}
		if (max > tol) {
			keep[at] = 1;
			stack.push([a, at], [at, b]);
		}
	}
	return pts.filter((_, i) => keep[i]);
}

const simple = new Map([...ways].map(([id, g]) => [id, simplify(g.map(proj), TOL)]));
const key = (p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;

// Join way segments end to end into closed rings.
function rings(segs) {
	const left = segs.map((s) => [...s]);
	const out = [];
	while (left.length) {
		let ring = left.shift();
		let grew = true;
		while (grew && key(ring[0]) !== key(ring.at(-1))) {
			grew = false;
			for (let i = 0; i < left.length; i++) {
				const s = left[i];
				if (key(s[0]) === key(ring.at(-1))) ring = ring.concat(s.slice(1));
				else if (key(s.at(-1)) === key(ring.at(-1))) ring = ring.concat([...s].reverse().slice(1));
				else if (key(s.at(-1)) === key(ring[0])) ring = s.concat(ring.slice(1));
				else if (key(s[0]) === key(ring[0])) ring = [...s].reverse().concat(ring.slice(1));
				else continue;
				left.splice(i, 1);
				grew = true;
				break;
			}
		}
		out.push(ring);
	}
	return out;
}
const area = (r) =>
	r.reduce((a, p, i) => a + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0) /
	2;
const f = (n) => Math.round(n * 10) / 10;
const path = (r, close = true) =>
	'M' + r.map((p) => `${f(p[0])} ${f(p[1])}`).join('L') + (close ? 'Z' : '');
function centroid(r) {
	let cx = 0;
	let cy = 0;
	const a = area(r);
	for (let i = 0; i < r.length; i++) {
		const [x0, y0] = r[i];
		const [x1, y1] = r[(i + 1) % r.length];
		const c = x0 * y1 - x1 * y0;
		cx += (x0 + x1) * c;
		cy += (y0 + y1) * c;
	}
	return [f(cx / (6 * a)), f(cy / (6 * a))];
}

const talukas = {};
for (const r of rels) {
	const segs = r.members
		.filter((m) => m.type === 'way' && m.role !== 'inner')
		.map((m) => simple.get(m.ref));
	const ring = rings(segs).sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)))[0];
	const [cx, cy] = centroid(ring);
	talukas[SLUG(r.tags.name)] = {
		d: path(ring),
		cx,
		cy,
		mr: r.tags['name:mr']?.replace(/ तालुका$/, '')
	};
}

const outerSegs = [...simple].filter(([id]) => uses.get(id) === 1).map(([, s]) => s);
const outline = rings(outerSegs).sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)))[0];
const borders = [...simple]
	.filter(([id]) => uses.get(id) > 1)
	.map(([, s]) => path(s, false))
	.join('');

// Sea: the outline's western run between its northernmost and southernmost points, closed to the left edge.
const top = outline.reduce((b, p, i) => (p[1] < outline[b][1] ? i : b), 0);
const bottom = outline.reduce((b, p, i) => (p[1] > outline[b][1] ? i : b), 0);
const run = (a, b) => {
	const out = [];
	for (let i = a; ; i = (i + 1) % outline.length) {
		out.push(outline[i]);
		if (i === b) return out;
	}
};
const runs = [run(top, bottom), run(bottom, top).reverse()];
const coast = runs.sort(
	(a, b) => a.reduce((s, p) => s + p[0], 0) / a.length - b.reduce((s, p) => s + p[0], 0) / b.length
)[0];
// The extreme points sit inland on the district borders: trim to the westernmost point of the top and bottom bands.
const band = (from, to) => coast.slice(from, to).reduce((b, p) => (p[0] < b[0] ? p : b));
const a = coast.indexOf(band(0, Math.ceil(coast.length * 0.08)));
const z = coast.lastIndexOf(band(Math.floor(coast.length * 0.95), coast.length));
const shore = coast.slice(a, z + 1);
const sea = path([[-200, shore[0][1]], ...shore, [shore.at(-1)[0], H + 40], [-200, H + 40]]);

const out = `// Generated by scripts/taluka-geo.mjs from OpenStreetMap (© OpenStreetMap contributors, ODbL). Do not edit.
export const TALUKA_GEO = ${JSON.stringify({ width: W, height: H, talukas, outline: path(outline), borders, sea })} as const;

/** Same projection as the paths: lon/lat → SVG x/y. */
export const project = (lon: number, lat: number): [number, number] => [
	${PAD} + (lon - ${minLon}) * ${cos} * ${k},
	${PAD} + (${maxLat} - lat) * ${k}
];
`;
const dest = fileURLToPath(new URL('../src/lib/journal/content/talukaGeo.ts', import.meta.url));
await writeFile(dest, out);
console.log('talukas', Object.keys(talukas).length, 'size', W, 'x', H, 'bytes', out.length);
