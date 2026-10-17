// BACKEND §7.3 osrm-matrix: OSRM (car) on the region extract → all ordered pairs of matrix_points →
// raw + corrected duration, distance, route shape (≤ 60 km, ~10 m simplified, polyline5) → travel_matrix.
// Incremental by default (missing pairs or points changed since computed_at); `--full` recomputes all.
// `--month=N` picks the monsoon month (default: current month) — re-run on 1 Jun and 1 Oct (DECISIONS P3-3).
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import polyline from '@mapbox/polyline';
import { DATA, db, docker, logger, target } from '../lib/common.ts';
import { correctedDuration, expectedPairs, segKey, type Factors, type Flag } from './correct.ts';
import { simplify } from './simplify.ts';

const log = logger('osrm-matrix');
const IMAGE = 'ghcr.io/project-osrm/osrm-backend:v6.0.0';
const NAME = 'crabwalk-osrm';
const PORT = 5000;
const SHAPE_MAX_M = 60_000; // A4
const full = process.argv.includes('--full');
const month = Number(process.argv.find((a) => a.startsWith('--month='))?.split('=')[1] ?? new Date().getMonth() + 1);

// 1. OSRM graph (rebuilt only when the extract changed).
const osrmDir = join(DATA, 'osrm');
mkdirSync(osrmDir, { recursive: true });
const pbf = join(osrmDir, 'region.osm.pbf');
const src = join(DATA, 'region.osm.pbf');
if (!existsSync(join(osrmDir, 'region.osrm.mldgr')) || statSync(src).mtimeMs > statSync(pbf).mtimeMs) {
	log('building OSRM graph (car profile)');
	copyFileSync(src, pbf);
	docker(IMAGE, ['osrm-extract', '-p', '/opt/car.lua', '/data/osrm/region.osm.pbf']);
	docker(IMAGE, ['osrm-partition', '/data/osrm/region.osrm']);
	docker(IMAGE, ['osrm-customize', '/data/osrm/region.osrm']);
}
try {
	execFileSync('docker', ['rm', '-f', NAME], { stdio: 'ignore' });
} catch {}
docker(IMAGE, ['osrm-routed', '--algorithm', 'mld', '/data/osrm/region.osrm'], { name: NAME, detach: true, ports: [`${PORT}:5000`] });
for (let i = 0; ; i++) {
	try {
		if ((await fetch(`http://127.0.0.1:${PORT}/nearest/v1/driving/73.3,17.0`)).ok) break;
	} catch {}
	if (i > 60) throw new Error('osrm-routed did not start');
	await new Promise((r) => setTimeout(r, 1000));
}

const client = await db();
try {
	// 2. Sync matrix_points from published listings (unpublished/deleted → removed, cascades to matrix rows).
	const sync = await client.query(`
		with src as (
			select 'place'::public.entity_type t, id, location, coalesce(updated_at, created_at) changed from public.places where status = 'published'
			union all select 'stay', id, location, coalesce(updated_at, created_at) from public.stays where status = 'published'
			union all select 'eatery', id, location, coalesce(updated_at, created_at) from public.eateries where status = 'published'
		), del as (
			delete from public.matrix_points m where not exists (select 1 from src where src.t = m.entity_type and src.id = m.entity_id) returning 1
		), up as (
			insert into public.matrix_points (entity_type, entity_id, location)
			select t, id, location from src
			on conflict (entity_type, entity_id) do update set location = excluded.location, updated_at = now()
			where not extensions.st_equals(matrix_points.location::extensions.geometry, excluded.location::extensions.geometry)
			returning 1
		) select (select count(*) from del) removed, (select count(*) from up) upserted`);
	log(`matrix_points sync: ${JSON.stringify(sync.rows[0])}`);

	const points = (
		await client.query<{ id: string; lon: number; lat: number; changed: Date }>(
			`select id, extensions.st_x(location::extensions.geometry) lon, extensions.st_y(location::extensions.geometry) lat,
			        coalesce(updated_at, created_at) changed from public.matrix_points`
		)
	).rows;

	// 3. Factors (G8 config table) + flagged segments (non-excluded flags → OSM node pairs).
	const cf = Object.fromEntries(
		(await client.query<{ type: string; multiplier: string; active_months: number[] | null }>(
			`select type, multiplier, active_months from public.correction_factors`
		)).rows.map((r) => [r.type, r])
	);
	const factors: Factors = {
		ghat: Number(cf.ghat?.multiplier ?? 1),
		coastal: Number(cf.coastal?.multiplier ?? 1),
		monsoon: Number(cf.monsoon?.multiplier ?? 1),
		monsoonMonths: cf.monsoon?.active_months ?? []
	};
	const flagRows = (await client.query<{ osm_way_id: string; flag: Flag }>(
		`select osm_way_id, flag from public.road_segments_flags where not excluded`
	)).rows;
	const wayFlags = new Map<number, Set<Flag>>();
	for (const r of flagRows) {
		const id = Number(r.osm_way_id);
		(wayFlags.get(id) ?? wayFlags.set(id, new Set()).get(id)!).add(r.flag);
	}
	const segFlags = new Map<string, Set<Flag>>();
	for (const line of readFileSync(join(DATA, 'highway-ways.ndjson'), 'utf8').split('\n')) {
		if (!line) continue;
		const w = JSON.parse(line) as { id: number; nodes: number[] };
		const f = wayFlags.get(w.id);
		if (f) for (let i = 1; i < w.nodes.length; i++) segFlags.set(segKey(w.nodes[i - 1], w.nodes[i]), f);
	}
	log(`factors ${JSON.stringify(factors)}, month ${month}; ${wayFlags.size} flagged ways → ${segFlags.size} segments`);

	// 4. Pairs to compute.
	const existing = new Map(
		(await client.query<{ k: string; computed_at: Date }>(
			`select from_point_id || ':' || to_point_id k, computed_at from public.travel_matrix`
		)).rows.map((r) => [r.k, r.computed_at])
	);
	const todo: [typeof points[0], typeof points[0]][] = [];
	for (const a of points)
		for (const b of points) {
			if (a.id === b.id) continue;
			const at = existing.get(`${a.id}:${b.id}`);
			if (full || !at || at < a.changed || at < b.changed) todo.push([a, b]);
		}
	log(`${points.length} points → ${expectedPairs(points.length)} pairs; computing ${todo.length}${full ? ' (full)' : ''}`);

	// 5. Route each pair (8 in flight) and upsert in batches.
	const rows: (string | number | null)[][] = [];
	const failed: string[] = [];
	const route = async ([a, b]: (typeof todo)[0]) => {
		const url = `http://127.0.0.1:${PORT}/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson&annotations=nodes,duration`;
		const res = (await (await fetch(url)).json()) as {
			code: string;
			routes?: { duration: number; distance: number; geometry: { coordinates: [number, number][] }; legs: { annotation: { nodes: number[]; duration: number[] } }[] }[];
		};
		const r = res.routes?.[0];
		if (res.code !== 'Ok' || !r) return void failed.push(`${a.id}→${b.id} ${res.code}`);
		const { nodes, duration } = r.legs[0].annotation;
		const flags = duration.map((_, i) => segFlags.get(segKey(nodes[i], nodes[i + 1])));
		const shape =
			r.distance <= SHAPE_MAX_M
				? polyline.encode(simplify(r.geometry.coordinates, 10).map(([lon, lat]) => [lat, lon]))
				: null;
		rows.push([a.id, b.id, Math.round(r.duration), Math.round(r.distance), correctedDuration(duration, flags, factors, month), shape]);
	};
	for (let i = 0; i < todo.length; i += 8) await Promise.all(todo.slice(i, i + 8).map(route));

	for (let i = 0; i < rows.length; i += 1000) {
		const c = rows.slice(i, i + 1000);
		const col = (k: number) => c.map((r) => r[k]);
		await client.query(
			`insert into public.travel_matrix (from_point_id, to_point_id, duration_s, distance_m, duration_corrected_s, route_shape, computed_at)
			 select *, now() from unnest($1::uuid[], $2::uuid[], $3::int[], $4::int[], $5::int[], $6::text[])
			 on conflict (from_point_id, to_point_id) do update set duration_s = excluded.duration_s, distance_m = excluded.distance_m,
			   duration_corrected_s = excluded.duration_corrected_s, route_shape = excluded.route_shape, computed_at = now()`,
			[col(0), col(1), col(2), col(3), col(4), col(5)]
		);
	}
	const total = Number((await client.query(`select count(*) from public.travel_matrix`)).rows[0].count);
	const bad = Number((await client.query(`select count(*) from public.travel_matrix where duration_corrected_s < duration_s`)).rows[0].count);
	log(`[${target()}] upserted ${rows.length}; travel_matrix rows ${total} / expected ${expectedPairs(points.length)}; corrected<raw: ${bad}; unroutable: ${failed.length}`);
	for (const f of failed) log(`  unroutable ${f}`);
	if (bad) throw new Error('corrected < raw found');
} finally {
	await client.end();
	execFileSync('docker', ['rm', '-f', NAME], { stdio: 'ignore' });
}
log('done');
