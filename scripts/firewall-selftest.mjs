// Proves the firewall check still catches a violating fixture (BACKEND §15: AI firewall static check).
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const r = spawnSync(process.execPath, [join(import.meta.dirname, 'check-ai-firewall.mjs'), join(import.meta.dirname, '__fixtures__', 'firewall')], { encoding: 'utf8' });
const n = Number(r.stderr.match(/(\d+) problem/)?.[1] ?? 0);
if (r.status !== 1 || n !== 4) {
	console.error(`firewall self-test failed: exit ${r.status}, ${n} problems (want exit 1, 4)\n${r.stdout}${r.stderr}`);
	process.exit(1);
}
console.log('AI firewall self-test: ok (fixture violations caught)');
