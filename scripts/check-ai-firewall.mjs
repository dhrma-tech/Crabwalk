// AI firewall static check (CLAUDE.md §2, BACKEND §1.1 / §6.1). Fails when:
//  1. any AI code path references Ola (imports of ola-proxy, /ola/ routes, olamaps, or any OLA_ variable);
//  2. OLA_API_KEY appears in code outside services/ola-proxy;
//  3. any code outside services/ola-proxy imports from it.
// Usage: node scripts/check-ai-firewall.mjs [root]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.argv[2] ?? join(import.meta.dirname, '..');
const SKIP = new Set(['node_modules', '.git', '.svelte-kit', '.wrangler', 'data', 'dist', 'build', 'test-results']);
const CODE = /\.(ts|js|mjs|cjs|svelte|tsx|jsx|sql)$/;
// Paths that hold AI/LLM code now or later (P8). Keep in sync with where AI code is placed.
const AI = [/^services\/api\/ai\//, /^apps\/web\/src\/lib\/ai\//, /^apps\/web\/src\/routes\/api\/ai\//, /^supabase\/functions\/ai[-_/]/];
const OLA_DIR = /^services\/ola-proxy\//;

function* walk(dir) {
	for (const name of readdirSync(dir)) {
		if (SKIP.has(name)) continue;
		const p = join(dir, name);
		if (statSync(p).isDirectory()) yield* walk(p);
		else if (CODE.test(name)) yield p;
	}
}

const problems = [];
for (const file of walk(root)) {
	const rel = relative(root, file).split(sep).join('/');
	if (rel === 'scripts/check-ai-firewall.mjs' || rel.startsWith('scripts/__fixtures__/')) continue;
	const text = readFileSync(file, 'utf8');
	const lines = text.split('\n');
	const hit = (re, why) =>
		lines.forEach((l, i) => re.test(l) && problems.push(`${rel}:${i + 1} ${why}: ${l.trim().slice(0, 100)}`));

	if (AI.some((r) => r.test(rel))) {
		hit(/ola-proxy|olamaps|['"`]\/ola\/|OLA_/i, 'AI code must not reach Ola');
	}
	if (!OLA_DIR.test(rel)) {
		hit(/OLA_API_KEY/, 'OLA_API_KEY outside services/ola-proxy');
		hit(/from\s+['"][^'"]*ola-proxy|require\(\s*['"][^'"]*ola-proxy|import\(\s*['"][^'"]*ola-proxy/, 'import of ola-proxy');
	}
}

if (problems.length) {
	console.error(`AI firewall: ${problems.length} problem(s)\n` + problems.join('\n'));
	process.exit(1);
}
console.log('AI firewall: ok');
