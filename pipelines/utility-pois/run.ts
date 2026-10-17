// BACKEND §7.4 utility-pois: OSM features for the 11 utility types → utility_pois (source 'osm').
// Ways/areas are stored at their vertex centroid with a negative osm_id (nodes positive) to avoid id clashes.
// Verifier rows (source 'verifier') are never touched. taluka_id set from talukas.boundary.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA, db, docker, ensureOsmium, logger, OSMIUM_IMAGE, target } from '../lib/common.ts';

const log = logger('utility-pois');

// utility_type → OSM tag filters (osmium tags-filter syntax, nwr = any element)
const TYPES: Record<string, string[]> = {
	fuel: ['amenity=fuel'],
	atm: ['amenity=atm'],
	hospital: ['amenity=hospital', 'healthcare=hospital'],
	pharmacy: ['amenity=pharmacy', 'healthcare=pharmacy'],
	police: ['amenity=police'],
	toilet: ['amenity=toilets'],
	ev_charger: ['amenity=charging_station'],
	mechanic: ['shop=car_repair', 'shop=motorcycle_repair'],
	bus_stand: ['amenity=bus_station'],
	railway_station: ['railway=station'],
	ferry_jetty: ['amenity=ferry_terminal']
};

type F = { properties: Record<string, string>; geometry: { type: string; coordinates: unknown } };
const match = (p: Record<string, string>, filter: string) => {
	const [k, v] = filter.split('=');
	return p[k] === v;
};
const centroid = (g: F['geometry']): [number, number] => {
	if (g.type === 'Point') return g.coordinates as [number, number];
	const flat = (JSON.stringify(g.coordinates).match(/-?\d+\.\d+,-?\d+\.\d+/g) ?? []).map((s) => s.split(',').map(Number));
	return [flat.reduce((a, p) => a + p[0], 0) / flat.length, flat.reduce((a, p) => a + p[1], 0) / flat.length];
};

ensureOsmium();
const filters = [...new Set(Object.values(TYPES).flat())].map((f) => `nwr/${f}`);
docker(OSMIUM_IMAGE, ['tags-filter', '/data/region.osm.pbf', ...filters, '-o', '/data/utilities.osm.pbf', '--overwrite']);
docker(OSMIUM_IMAGE, ['export', '/data/utilities.osm.pbf', '-o', '/data/utilities.geojson', '-a', 'type,id', '--overwrite']);
const features = JSON.parse(readFileSync(join(DATA, 'utilities.geojson'), 'utf8')).features as F[];

const rows: { type: string; osm_id: number; lon: number; lat: number; name: string | null; phone: string | null }[] = [];
const seen = new Set<string>();
for (const f of features) {
	const p = f.properties;
	const type = Object.entries(TYPES).find(([, fs]) => fs.some((x) => match(p, x)))?.[0];
	if (!type) continue;
	// osmium export -a type,id → @type node|way|relation, @id numeric; areas from ways keep the way id.
	const osmId = (p['@type'] === 'node' ? 1 : -1) * Number(p['@id']);
	const key = `${type}:${osmId}`;
	if (seen.has(key)) continue;
	seen.add(key);
	const [lon, lat] = centroid(f.geometry);
	rows.push({ type, osm_id: osmId, lon, lat, name: p['name:en'] ?? p.name ?? null, phone: p.phone ?? p['contact:phone'] ?? null });
}
const byType = Object.fromEntries(Object.keys(TYPES).map((t) => [t, rows.filter((r) => r.type === t).length]));
log(`${rows.length} utility POIs from OSM: ${JSON.stringify(byType)}`);

const client = await db();
await client.query('begin');
const col = <K extends keyof (typeof rows)[0]>(k: K) => rows.map((r) => r[k]);
const up = await client.query(
	`insert into public.utility_pois (type, osm_id, location, name, phone, source)
	 select t::public.utility_type, id, extensions.st_setsrid(extensions.st_makepoint(lon, lat), 4326)::extensions.geography, n, ph, 'osm'
	 from unnest($1::text[], $2::bigint[], $3::float8[], $4::float8[], $5::text[], $6::text[]) as u(t, id, lon, lat, n, ph)
	 on conflict (type, osm_id) where source = 'osm' do update
	   set location = excluded.location, name = excluded.name, phone = excluded.phone, updated_at = now()`,
	[col('type'), col('osm_id'), col('lon'), col('lat'), col('name'), col('phone')]
);
const del = await client.query(
	`delete from public.utility_pois u where source = 'osm'
	 and not exists (select 1 from unnest($1::text[], $2::bigint[]) k(t, id) where k.t::public.utility_type = u.type and k.id = u.osm_id)`,
	[col('type'), col('osm_id')]
);
await client.query(
	`update public.utility_pois u set taluka_id = t.id from public.talukas t
	 where u.source = 'osm' and t.boundary is not null and extensions.st_covers(t.boundary, u.location) and u.taluka_id is distinct from t.id`
);
await client.query('commit');
const outside = (await client.query(`select count(*) from public.utility_pois where source = 'osm' and taluka_id is null`)).rows[0].count;
await client.end();
log(`[${target()}] upserted ${up.rowCount}, removed ${del.rowCount} stale; ${outside} outside the district (kept, no taluka)`);
log('done');
