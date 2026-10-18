// BACKEND §7.5 trails: named OSM footpaths + hiking routes → trails (source 'osm', not yet verified).
// Difficulty from sac_scale (DECISIONS P9-1). Rows the team verified or recorded (osm_verified /
// team_recorded) are never touched; a team-set difficulty is kept. GPX is generated from geometry on demand.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA, db, docker, ensureOsmium, logger, OSMIUM_IMAGE, target } from '../lib/common.ts';
import { difficulty } from './difficulty.ts';

const log = logger('trails');
type F = { properties: Record<string, string>; geometry: { type: string; coordinates: unknown } };

ensureOsmium();
docker(OSMIUM_IMAGE, ['tags-filter', '/data/region.osm.pbf', 'w/highway=path,footway,track', 'r/route=hiking', '-o', '/data/trails.osm.pbf', '--overwrite']);
docker(OSMIUM_IMAGE, ['export', '/data/trails.osm.pbf', '-o', '/data/trails.geojson', '-a', 'type,id', '--geometry-types=linestring', '--overwrite']);
const features = JSON.parse(readFileSync(join(DATA, 'trails.geojson'), 'utf8')).features as F[];

const rows = features
	.filter((f) => f.geometry.type === 'LineString' && (f.properties.name || f.properties['name:en']))
	// Tracks only when they are clearly a walking route (named + sac_scale), not farm/forest tracks.
	.filter((f) => f.properties.highway !== 'track' || f.properties.sac_scale)
	.map((f) => {
		const p = f.properties;
		return {
			osm_id: (p['@type'] === 'relation' ? -1 : 1) * Number(p['@id']),
			name_en: p['name:en'] ?? p.name,
			name_mr: p['name:mr'] ?? null,
			name_hi: p['name:hi'] ?? null,
			difficulty: difficulty(p.sac_scale),
			wkt: `LINESTRING(${(f.geometry.coordinates as [number, number][]).map(([x, y]) => `${x} ${y}`).join(',')})`
		};
	})
	.filter((r) => r.wkt.split(',').length >= 2);
log(`${rows.length} named trails from OSM`);

const client = await db();
await client.query('begin');
const col = <K extends keyof (typeof rows)[0]>(k: K) => rows.map((r) => r[k]);
const up = await client.query(
	`insert into public.trails (osm_id, name_en, name_mr, name_hi, difficulty, geometry, source)
	 select id, en, mr, hi, d, extensions.st_geogfromtext('SRID=4326;' || g), 'osm'
	 from unnest($1::bigint[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[]) as u(id, en, mr, hi, d, g)
	 on conflict (osm_id) do update set
	   name_en = excluded.name_en, name_mr = coalesce(excluded.name_mr, trails.name_mr), name_hi = coalesce(excluded.name_hi, trails.name_hi),
	   difficulty = coalesce(trails.difficulty, excluded.difficulty), geometry = excluded.geometry, updated_at = now()
	 where trails.source = 'osm'`,
	[col('osm_id'), col('name_en'), col('name_mr'), col('name_hi'), col('difficulty'), col('wkt')]
);
const del = await client.query(
	`delete from public.trails t where source = 'osm' and osm_id is not null and not (osm_id = any($1::bigint[]))`,
	[col('osm_id')]
);
await client.query('commit');
await client.end();
log(`[${target()}] upserted ${up.rowCount}, removed ${del.rowCount} stale`);
log('done');
