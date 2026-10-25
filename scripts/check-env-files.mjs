// Fails when a committed env file turns on the dev auth bypass (apps/web/src/lib/devAuth.ts).
// Usage: node scripts/check-env-files.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
	.split('\0')
	.filter((f) => /(^|\/)\.env([.\w-]*)?$/.test(f) || /(^|\/)[\w.-]+\.env$/.test(f));
const bad = files.filter((f) =>
	/^\s*(export\s+)?DEV_BYPASS_AUTH\s*=\s*["']?true["']?\s*(#.*)?$/im.test(readFileSync(f, 'utf8'))
);
if (bad.length) {
	console.error(`DEV_BYPASS_AUTH=true in committed env file(s): ${bad.join(', ')}`);
	process.exit(1);
}
console.log(`env guard: ${files.length} committed env file(s), dev bypass off`);
