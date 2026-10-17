// Road flags for correction factors (DECISIONS P3-2, BACKEND §3.2 road_segments_flags).
// ghat    = drivable way whose name / name:mr contains "ghat" / "घाट", or with a vertex inside ghat-zones.geojson
// coastal = drivable way with a vertex within COASTAL_KM of the OSM coastline
// Writes data/highway-ways.ndjson (way id + node ids, used by osrm-matrix) and upserts source='auto' rows.
// Team rows (source='team') and team exclusions (excluded=true) are never touched.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA, ROOT, db, docker, ensureOsmium, logger, OSMIUM_IMAGE, target } from '../lib/common.ts';
import { parseOplWays, coastIndex, type Way } from './geo.ts';

const log = logger('road-flags');
const COASTAL_KM = 1;
const DRIVABLE = /^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|track)(_link)?$/;

ensureOsmium();
log('filtering highways + coastline');
docker(OSMIUM_IMAGE, ['tags-filter', '/data/region.osm.pbf', 'w/highway', '-o', '/data/highways.osm.pbf', '--overwrite']);
docker(OSMIUM_IMAGE, ['add-locations-to-ways', '/data/highways.osm.pbf', '-o', '/data/highways-loc.osm.pbf', '--overwrite']);
docker(OSMIUM_IMAGE, ['cat', '/data/highways-loc.osm.pbf', '-t', 'way', '-f', 'opl,locations_on_ways=true', '-o', '/data/highways.opl', '--overwrite']);
docker(OSMIUM_IMAGE, ['tags-filter', '/data/region.osm.pbf', 'w/natural=coastline', '-o', '/data/coast.osm.pbf', '--overwrite']);
docker(OSMIUM_IMAGE, ['add-locations-to-ways', '/data/coast.osm.pbf', '-o', '/data/coast-loc.osm.pbf', '--overwrite']);
docker(OSMIUM_IMAGE, ['cat', '/data/coast-loc.osm.pbf', '-t', 'way', '-f', 'opl,locations_on_ways=true', '-o', '/data/coast.opl', '--overwrite']);

const ways = parseOplWays(readFileSync(join(DATA, 'highways.opl'), 'utf8')).filter((w) => DRIVABLE.test(w.tags.highway ?? ''));
const coast = parseOplWays(readFileSync(join(DATA, 'coast.opl'), 'utf8'));
log(`${ways.length} drivable ways, ${coast.length} coastline ways`);

writeFileSync(join(DATA, 'highway-ways.ndjson'), ways.map((w) => JSON.stringify({ id: w.id, nodes: w.nodes.map((n) => n.id) })).join('\n'));

const zones = JSON.parse(readFileSync(join(ROOT, 'road-flags', 'ghat-zones.geojson'), 'utf8')).features as {
	properties: { name: string };
	geometry: { coordinates: number[][][] };
}[];
const inZone = (lon: number, lat: number) =>
	zones.some((z) => {
		const xs = z.geometry.coordinates[0].map((p) => p[0]), ys = z.geometry.coordinates[0].map((p) => p[1]);
		return lon >= Math.min(...xs) && lon <= Math.max(...xs) && lat >= Math.min(...ys) && lat <= Math.max(...ys);
	});
const ghatName = /ghat|घाट/i;
const nearCoast = coastIndex(coast, COASTAL_KM);

const flags: [number, 'ghat' | 'coastal'][] = [];
for (const w of ways as Way[]) {
	const named = ghatName.test(w.tags.name ?? '') || ghatName.test(w.tags['name:mr'] ?? '') || ghatName.test(w.tags['name:en'] ?? '');
	if (named || w.nodes.some((n) => inZone(n.lon, n.lat))) flags.push([w.id, 'ghat']);
	if (w.nodes.some((n) => nearCoast(n.lon, n.lat))) flags.push([w.id, 'coastal']);
}
const count = (f: string) => flags.filter((x) => x[1] === f).length;
log(`auto flags: ghat ${count('ghat')}, coastal ${count('coastal')}`);

const client = await db();
await client.query('begin');
await client.query(`create temp table auto_flags (osm_way_id bigint, flag public.correction_type) on commit drop`);
for (let i = 0; i < flags.length; i += 5000) {
	const chunk = flags.slice(i, i + 5000);
	await client.query(
		`insert into auto_flags select * from unnest($1::bigint[], $2::public.correction_type[])`,
		[chunk.map((f) => f[0]), chunk.map((f) => f[1])]
	);
}
const del = await client.query(
	`delete from public.road_segments_flags r where r.source = 'auto' and not r.excluded
	 and not exists (select 1 from auto_flags a where a.osm_way_id = r.osm_way_id and a.flag = r.flag)`
);
const ins = await client.query(
	`insert into public.road_segments_flags (osm_way_id, flag, source)
	 select distinct osm_way_id, flag, 'auto' from auto_flags on conflict (osm_way_id, flag) do nothing`
);
await client.query('commit');
await client.end();
log(`[${target()}] road_segments_flags: +${ins.rowCount} new, −${del.rowCount} stale auto rows`);
log('done');
