// Full SQL backup of the hosted Supabase database into backups/<timestamp>/ (git-ignored).
// Usage (repo root): pnpm db:backup   — needs SUPABASE_DB_PASSWORD in .env (read by the Supabase CLI) and a one-time
// `npx supabase link --project-ref uwaqcutysdcmxfjpfktt`.
// Writes roles.sql, schema.sql and data.sql (all app data incl. auth users and storage object rows; photo files
// themselves stay in Supabase Storage). Restore order: roles → schema → data (see docs/DEPLOY_CHECKLIST.md).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const env = { ...process.env };
if (existsSync('.env'))
	for (const line of readFileSync('.env', 'utf8').split('\n')) {
		const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
		if (m && !env[m[1]]) env[m[1]] = m[2].trim();
	}
if (!env.SUPABASE_DB_PASSWORD) {
	console.error('SUPABASE_DB_PASSWORD missing (.env)');
	process.exit(1);
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dir = join('backups', stamp);
mkdirSync(dir, { recursive: true });

const dump = (file, ...flags) => {
	execFileSync(
		process.platform === 'win32' ? 'npx.cmd' : 'npx',
		['supabase', 'db', 'dump', '--linked', '-f', join(dir, file), ...flags],
		{ env, stdio: ['ignore', 'ignore', 'inherit'], shell: process.platform === 'win32' }
	);
	console.log(`${join(dir, file)}  ${(statSync(join(dir, file)).size / 1024).toFixed(0)} KB`);
};
dump('roles.sql', '--role-only');
dump('schema.sql');
dump('data.sql', '--data-only', '--use-copy');
console.log(`backup done: ${dir}`);
