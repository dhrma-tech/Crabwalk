// Local tile host for dev/e2e: static files from data/tiles with HTTP Range + CORS (what PMTiles needs).
// Usage: node tiles/serve.ts [port=4174]
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, normalize } from 'node:path';
import { DATA } from '../lib/common.ts';

const root = join(DATA, 'tiles');
const port = Number(process.argv[2] ?? 4174);
const types: Record<string, string> = { '.pmtiles': 'application/vnd.pmtiles', '.json': 'application/json' };

createServer((req, res) => {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Headers', 'Range');
	res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, ETag');
	if (req.method === 'OPTIONS') return void res.writeHead(204).end();
	const path = normalize(join(root, decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)));
	if (!path.startsWith(root) || !existsSync(path) || statSync(path).isDirectory()) return void res.writeHead(404).end();
	const size = statSync(path).size;
	const type = types[path.slice(path.lastIndexOf('.'))] ?? 'application/octet-stream';
	const m = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
	if (m) {
		const start = m[1] ? Number(m[1]) : size - Number(m[2]);
		const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
		if (start > end || start >= size) return void res.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
		res.writeHead(206, { 'Content-Type': type, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes' });
		return void createReadStream(path, { start, end }).pipe(res);
	}
	res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' });
	createReadStream(path).pipe(res);
}).listen(port, () => console.log(`tiles on http://localhost:${port}`));
