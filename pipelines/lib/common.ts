// Shared helpers for laptop pipelines (BACKEND §7): paths, run log, docker, DB connection.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DATA = join(ROOT, 'data');
export const region = JSON.parse(readFileSync(join(ROOT, 'region.json'), 'utf8')) as {
	code: string;
	geofabrik: string;
	district: { name: string; admin_level: string };
	taluka_admin_level: string;
	buffer_km: number;
	protomaps_maxzoom: number;
};
mkdirSync(DATA, { recursive: true });

const repoEnv = join(ROOT, '..', '.env');
if (existsSync(repoEnv)) process.loadEnvFile(repoEnv);

/** Append a timestamped line to data/<step>.log and echo it. */
export function logger(step: string) {
	const file = join(DATA, `${step}.log`);
	return (msg: string) => {
		const line = `${new Date().toISOString()} ${msg}`;
		console.log(line);
		appendFileSync(file, line + '\n');
	};
}

/** Run a container with pipelines/data mounted at /data. */
export function docker(image: string, args: string[], opts: { name?: string; detach?: boolean; ports?: string[] } = {}) {
	const flags = ['run', '--rm', '-v', `${DATA}:/data`];
	if (opts.name) flags.push('--name', opts.name);
	if (opts.detach) flags.push('-d');
	for (const p of opts.ports ?? []) flags.push('-p', p);
	return execFileSync('docker', [...flags, image, ...args], { stdio: opts.detach ? 'pipe' : 'inherit' });
}

export const OSMIUM_IMAGE = 'crabwalk/osmium:1';
export function ensureOsmium() {
	try {
		execFileSync('docker', ['image', 'inspect', OSMIUM_IMAGE], { stdio: 'ignore' });
	} catch {
		execFileSync('docker', ['build', '-t', OSMIUM_IMAGE, join(ROOT, 'docker', 'osmium')], {
			stdio: 'inherit'
		});
	}
}

/**
 * `--live` → hosted project (pooler URL from `supabase link` + SUPABASE_DB_PASSWORD); default → local stack.
 * PIPELINE_DB_URL overrides both.
 */
export function dbUrl() {
	if (process.env.PIPELINE_DB_URL) return process.env.PIPELINE_DB_URL;
	if (!process.argv.includes('--live')) return 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
	const pooler = readFileSync(join(ROOT, '..', 'supabase', '.temp', 'pooler-url'), 'utf8').trim();
	const pw = process.env.SUPABASE_DB_PASSWORD;
	if (!pw) throw new Error('SUPABASE_DB_PASSWORD not set (needed for --live)');
	return pooler.replace('@', `:${encodeURIComponent(pw)}@`);
}

export async function db() {
	const client = new pg.Client({ connectionString: dbUrl() });
	await client.connect();
	return client;
}

export const target = () => (process.argv.includes('--live') ? 'live' : 'local');
