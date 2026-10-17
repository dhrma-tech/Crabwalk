// One-off (re-runnable): nearest TideCheck station for each coastal anchor → tide_stations.
// Uses region.json tide_anchors (names of weather_points). ~6 requests (free tier: 50/day).
// Docs: https://tidecheck.com/developers  GET /api/stations/nearest?lat&lng  (X-API-Key)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, db, logger, target } from '../lib/common.ts';

const log = logger('tide-stations');
const key = process.env.TIDECHECK_API_KEY;
if (!key) throw new Error('TIDECHECK_API_KEY not set');
const anchors = (JSON.parse(readFileSync(join(ROOT, 'region.json'), 'utf8')).tide_anchors ?? []) as string[];

const client = await db();
const { rows } = await client.query<{ name: string; lon: number; lat: number }>(
	`select name, extensions.st_x(location::extensions.geometry) lon, extensions.st_y(location::extensions.geometry) lat
	 from public.weather_points where name = any ($1)`,
	[anchors]
);
const seen = new Set<string>();
for (const a of rows) {
	const res = await fetch(`https://tidecheck.com/api/stations/nearest?lat=${a.lat}&lng=${a.lon}`, { headers: { 'X-API-Key': key } });
	if (!res.ok) {
		log(`${a.name}: HTTP ${res.status}`);
		continue;
	}
	const body = (await res.json()) as unknown;
	const list = (Array.isArray(body) ? body : ((body as { stations?: unknown[] }).stations ?? [])) as {
		id: string;
		name: string;
		lat?: number;
		lng?: number;
		latitude?: number;
		longitude?: number;
		distance?: number;
	}[];
	const s = list[0];
	if (!s) {
		log(`${a.name}: no station`);
		continue;
	}
	const lat = s.lat ?? s.latitude!, lng = s.lng ?? s.longitude!;
	log(`${a.name} → ${s.name} (${s.id})${s.distance != null ? `, ${s.distance} km` : ''}`);
	if (seen.has(s.id)) continue;
	seen.add(s.id);
	await client.query(
		`insert into public.tide_stations (name, location, provider_station_id)
		 select $1, extensions.st_setsrid(extensions.st_makepoint($3, $2), 4326)::extensions.geography, $4
		 where not exists (select 1 from public.tide_stations where provider_station_id = $4)`,
		[s.name, lat, lng, s.id]
	);
}
const n = (await client.query(`select count(*) from public.tide_stations`)).rows[0].count;
await client.end();
log(`[${target()}] tide_stations: ${n}`);
