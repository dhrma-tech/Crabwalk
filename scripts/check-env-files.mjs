// Fails when a committed env file turns on the dev auth bypass or the dev quick sign-in
// (apps/web/src/lib/devAuth.ts, devAuth.server.ts), or carries a dev sign-in password.
// Usage: node scripts/check-env-files.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
	.split('\0')
	.filter((f) => /(^|\/)\.env([.\w-]*)?$/.test(f) || /(^|\/)[\w.-]+\.env$/.test(f));
const bad = files.filter((f) => {
	const text = readFileSync(f, 'utf8');
	return (
		/^\s*(export\s+)?(DEV_BYPASS_AUTH|DEV_QUICK_LOGIN)\s*=\s*["']?true["']?\s*(#.*)?$/im.test(text) ||
		/^\s*(export\s+)?DEV_LOGIN_PASSWORD\s*=\s*["']?[^\s"'#]/im.test(text)
	);
});
if (bad.length) {
	console.error(`dev bypass / quick sign-in on (or a dev password) in committed env file(s): ${bad.join(', ')}`);
	process.exit(1);
}
console.log(`env guard: ${files.length} committed env file(s), dev bypass off`);
