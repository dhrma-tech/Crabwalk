// BACKEND §7.1 osm-extract: Geofabrik zone → district + taluka boundaries → buffered region extract.
// Writes talukas.boundary in the DB (matched by English name). Idempotent; re-download only when Geofabrik updates.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA, db, docker, ensureOsmium, logger, OSMIUM_IMAGE, region, target } from '../lib/common.ts';

const log = logger('osm-extract');
const zoneUrl = `https://download.geofabrik.de/${region.geofabrik}-latest.osm.pbf`;
const zone = join(DATA, 'zone.osm.pbf');
const metaFile = join(DATA, 'zone.meta.json');

type Feature = { type: 'Feature'; properties: Record<string, string>; geometry: { type: string; coordinates: unknown } };

async function download() {
	const head = await fetch(zoneUrl, { method: 'HEAD', redirect: 'follow' });
	const lastModified = head.headers.get('last-modified') ?? '';
	const prev = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, 'utf8')) : {};
	if (existsSync(zone) && prev.lastModified === lastModified) {
		log(`zone extract up to date (${lastModified})`);
		return lastModified;
	}
	log(`downloading ${zoneUrl}`);
	const res = await fetch(zoneUrl, { redirect: 'follow' });
	if (!res.ok) throw new Error(`download failed: ${res.status}`);
	writeFileSync(zone, Buffer.from(await res.arrayBuffer()));
	writeFileSync(metaFile, JSON.stringify({ url: zoneUrl, lastModified }, null, 2));
	log(`downloaded ${(Number(head.headers.get('content-length')) / 1e6).toFixed(0)} MB, ${lastModified}`);
	return lastModified;
}

// Ray-casting point-in-polygon on the outer rings of a (Multi)Polygon.
function rings(g: Feature['geometry']): number[][][] {
	return g.type === 'Polygon'
		? [(g.coordinates as number[][][])[0]]
		: (g.coordinates as number[][][][]).map((p) => p[0]);
}
function inside([x, y]: number[], g: Feature['geometry']) {
	return rings(g).some((ring) => {
		let hit = false;
		for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
			const [xi, yi] = ring[i], [xj, yj] = ring[j];
			if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
		}
		return hit;
	});
}
function bbox(g: Feature['geometry']) {
	const pts = rings(g).flat();
	const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
	return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
// A taluka belongs to the district when most of its boundary vertices fall inside it
// (a vertex centroid can land in the sea for coastal talukas).
function mostlyInside(g: Feature['geometry'], outer: Feature['geometry']) {
	const pts = rings(g).flat();
	return pts.filter((p) => inside(p, outer)).length / pts.length > 0.5;
}

ensureOsmium();
const version = await download();

log('extracting administrative boundaries');
docker(OSMIUM_IMAGE, ['tags-filter', '/data/zone.osm.pbf', 'r/boundary=administrative', '-o', '/data/admin.osm.pbf', '--overwrite']);
docker(OSMIUM_IMAGE, ['export', '/data/admin.osm.pbf', '-o', '/data/admin.geojson', '-f', 'geojson', '--overwrite', '--geometry-types=polygon']);
const admin = JSON.parse(readFileSync(join(DATA, 'admin.geojson'), 'utf8')).features as Feature[];

const district = admin.find(
	(f) =>
		f.properties.admin_level === region.district.admin_level &&
		[f.properties.name, f.properties['name:en']].includes(region.district.name)
);
if (!district) throw new Error(`district "${region.district.name}" not found`);
const talukas = admin.filter(
	(f) => f.properties.admin_level === region.taluka_admin_level && mostlyInside(f.geometry, district.geometry)
);
log(`district found; ${talukas.length} talukas: ${talukas.map((t) => t.properties['name:en'] ?? t.properties.name).join(', ')}`);
writeFileSync(join(DATA, 'district.geojson'), JSON.stringify({ type: 'FeatureCollection', features: [district] }));
writeFileSync(join(DATA, 'talukas.geojson'), JSON.stringify({ type: 'FeatureCollection', features: talukas }));

// Buffered bbox extract so routes and map edges near the district border still work.
const [x0, y0, x1, y1] = bbox(district.geometry);
const dLat = region.buffer_km / 111, dLon = region.buffer_km / (111 * Math.cos(((y0 + y1) / 2) * (Math.PI / 180)));
const b = [x0 - dLon, y0 - dLat, x1 + dLon, y1 + dLat].map((v) => v.toFixed(4)).join(',');
writeFileSync(join(DATA, 'region.bbox'), b);
log(`region extract bbox ${b}`);
docker(OSMIUM_IMAGE, ['extract', '-b', b, '-s', 'complete_ways', '/data/zone.osm.pbf', '-o', '/data/region.osm.pbf', '--overwrite']);

// Taluka boundaries → DB (matched case-insensitively on English name).
const client = await db();
const { rows } = await client.query<{ id: string; name_en: string }>(
	`select t.id, t.name_en from public.talukas t join public.regions r on r.id = t.region_id where r.code_prefix = $1`,
	[region.code]
);
const norm = (s = '') =>
	s
		.toLowerCase()
		.replace(/\b(taluka|tehsil|taluk)\b/g, '')
		.replace(/[^a-z]/g, '');
const unmatched: string[] = [];
for (const f of talukas) {
	const names = [f.properties['name:en'], f.properties.name].map(norm);
	const row = rows.find((r) => names.includes(norm(r.name_en)));
	if (!row) {
		unmatched.push(f.properties['name:en'] ?? f.properties.name);
		continue;
	}
	await client.query(
		`update public.talukas set boundary = extensions.st_multi(extensions.st_geomfromgeojson($2))::extensions.geography, updated_at = now() where id = $1`,
		[row.id, JSON.stringify(f.geometry)]
	);
}
await client.end();
log(`[${target()}] talukas.boundary written for ${talukas.length - unmatched.length}/${rows.length}; unmatched OSM names: ${unmatched.join(', ') || 'none'}`);
log(`done (source ${version})`);
