// BACKEND §7.2 tiles: cut the region + one pack per taluka from a Protomaps basemap build (OSM, ODbL).
// Output: data/tiles/{region}.pmtiles, data/tiles/packs/<taluka>.pmtiles, _headers, manifest.json.
// `--deploy` uploads to the Cloudflare Pages project and writes talukas.pack_url / pack_version.
// Requires osm-extract (talukas.geojson, region.bbox). Each file must stay < 25 MiB (Pages limit).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA, ROOT, db, logger, region, target } from '../lib/common.ts';

const log = logger('tiles');
const PAGES_PROJECT = 'crabwalk-tiles';
const MAX_BYTES = 25 * 1024 * 1024;
const pmtiles = join(ROOT, 'bin', process.platform === 'win32' ? 'pmtiles.exe' : 'pmtiles');
const out = join(DATA, 'tiles');
mkdirSync(join(out, 'packs'), { recursive: true });

const builds = (await (await fetch('https://build-metadata.protomaps.dev/builds.json')).json()) as { key: string }[];
const build = builds.at(-1)!.key; // e.g. 20261017.pmtiles
const source = `https://build.protomaps.com/${build}`;
const version = build.replace('.pmtiles', '');
log(`source ${source}`);

const slug = (s: string) => s.toLowerCase().replace(/\s*taluka$/, '').replace(/[^a-z]+/g, '-');
const extract = (dest: string, area: string[]) =>
	execFileSync(pmtiles, ['extract', source, dest, `--maxzoom=${region.protomaps_maxzoom}`, ...area], { stdio: 'inherit' });

const files: { path: string; bytes: number }[] = [];
const regionFile = join(out, `${region.code.toLowerCase()}.pmtiles`);
extract(regionFile, [`--bbox=${readFileSync(join(DATA, 'region.bbox'), 'utf8').trim()}`]);
files.push({ path: `${region.code.toLowerCase()}.pmtiles`, bytes: statSync(regionFile).size });

const talukas = JSON.parse(readFileSync(join(DATA, 'talukas.geojson'), 'utf8')).features as {
	properties: Record<string, string>;
}[];
for (const t of talukas) {
	const name = t.properties['name:en'] ?? t.properties.name;
	const geo = join(DATA, `taluka-${slug(name)}.geojson`);
	writeFileSync(geo, JSON.stringify({ type: 'FeatureCollection', features: [t] }));
	const dest = join(out, 'packs', `${slug(name)}.pmtiles`);
	extract(dest, [`--region=${geo}`]);
	files.push({ path: `packs/${slug(name)}.pmtiles`, bytes: statSync(dest).size });
}

for (const f of files) log(`${f.path} ${(f.bytes / 1024 / 1024).toFixed(1)} MiB${f.bytes > MAX_BYTES ? '  ← OVER 25 MiB' : ''}`);
const over = files.filter((f) => f.bytes > MAX_BYTES);
if (over.length) throw new Error(`${over.length} file(s) exceed the 25 MiB Pages limit; lower protomaps_maxzoom in region.json`);

// Pages headers: CORS for the app origin + range requests, long cache (files are versioned by manifest).
writeFileSync(
	join(out, '_headers'),
	`/*\n  Access-Control-Allow-Origin: *\n  Access-Control-Allow-Headers: Range\n  Access-Control-Expose-Headers: Content-Length, Content-Range, ETag\n  Cache-Control: public, max-age=86400\n\n/*.pmtiles\n  Content-Type: application/vnd.pmtiles\n`
);
writeFileSync(join(out, "manifest.json"), JSON.stringify({ version, source: build, region: files[0].path, files }, null, 2));

if (process.argv.includes('--deploy')) {
	const base = process.env.PMTILES_BASE_URL;
	if (!base) throw new Error('PMTILES_BASE_URL not set');
	log(`deploying to Pages project ${PAGES_PROJECT}`);
	execFileSync('pnpm', ['--dir', join(ROOT, '..', 'apps', 'web'), 'exec', 'wrangler', 'pages', 'deploy', out, '--project-name', PAGES_PROJECT, '--branch', 'main', '--commit-dirty=true'], { stdio: 'inherit', shell: true });

	const client = await db();
	for (const t of talukas) {
		const name = t.properties['name:en'] ?? t.properties.name;
		await client.query(
			`update public.talukas set pack_url = $2, pack_version = $3, updated_at = now() where lower(name_en) = $1`,
			[slug(name).replace(/-/g, ' '), `${base.replace(/\/$/, '')}/packs/${slug(name)}.pmtiles`, version]
		);
	}
	await client.end();
	log(`[${target()}] talukas.pack_url / pack_version = ${version}`);
}
log('done');
