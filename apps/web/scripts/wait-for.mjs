// node scripts/wait-for.mjs <url> [timeout-seconds] — exit 0 once the URL answers (any status).
// Used by playwright.config.ts so the temp-gate preview starts only after the main build + preview are up:
// starting `wrangler pages dev` on .svelte-kit/cloudflare while `vite build` is still writing it corrupts the build.
import http from 'node:http';

const [url, secs = '240'] = process.argv.slice(2);
const until = Date.now() + Number(secs) * 1000;
const up = () =>
	new Promise((ok) => {
		const req = http.get(url, { agent: false }, (res) => {
			res.resume();
			res.on('end', () => ok(true));
		});
		req.on('error', () => ok(false));
		req.setTimeout(5000, () => req.destroy());
	});
let ready = false;
while (!ready && Date.now() < until) {
	ready = await up();
	if (!ready) await new Promise((r) => setTimeout(r, 500));
}
if (!ready) console.error(`wait-for: ${url} did not answer in ${secs}s`);
// No process.exit(): on Windows it can trip a libuv assertion while sockets close.
process.exitCode = ready ? 0 : 1;
