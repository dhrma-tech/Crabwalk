// Tiles host worker (deployed as _worker.js next to the PMTiles). Cloudflare Pages ignores the Range header
// (checked on the first deploy, DECISIONS P3-7), and PMTiles needs byte ranges (206). This streams the asset and
// returns only the requested bytes, stopping the read once the range is sent. Everything else passes through.
const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'Range',
	'Access-Control-Expose-Headers': 'Content-Length, Content-Range, ETag'
};

// Asset responses inside the worker carry no Content-Length, so file sizes come from the pipeline's manifest.
let sizes;
async function sizeOf(env, url, path) {
	sizes ??= env.ASSETS.fetch(new URL('/manifest.json', url))
		.then((r) => r.json())
		.then((m) => new Map(m.files.map((f) => ['/' + f.path, f.bytes])))
		.catch(() => ((sizes = undefined), new Map()));
	return (await sizes).get(path) ?? 0;
}

function withCors(res, extra = {}) {
	const headers = new Headers(res.headers);
	for (const [k, v] of Object.entries({ ...CORS, ...extra })) headers.set(k, v);
	return new Response(res.body, { status: res.status, headers });
}

export default {
	async fetch(request, env) {
		if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
		const url = new URL(request.url);
		const range = request.headers.get('Range');
		const asset = await env.ASSETS.fetch(new Request(url, { method: request.method }));
		if (!url.pathname.endsWith('.pmtiles') || !range || !asset.ok || !asset.body) return withCors(asset);

		const size = Number(asset.headers.get('Content-Length')) || (await sizeOf(env, url, url.pathname));
		const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
		if (!m || !size || (!m[1] && !m[2])) return withCors(asset);
		const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
		const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
		if (start >= size || start > end) {
			asset.body.cancel();
			return new Response(null, { status: 416, headers: { ...CORS, 'Content-Range': `bytes */${size}` } });
		}

		const { readable, writable } = new IdentityTransformStream();
		(async () => {
			const reader = asset.body.getReader();
			const writer = writable.getWriter();
			let pos = 0;
			try {
				while (pos <= end) {
					const { done, value } = await reader.read();
					if (done) break;
					const from = Math.max(start - pos, 0);
					const to = Math.min(end + 1 - pos, value.byteLength);
					if (to > from) await writer.write(value.subarray(from, to));
					pos += value.byteLength;
				}
			} finally {
				reader.cancel().catch(() => {});
				writer.close().catch(() => {});
			}
		})();
		return new Response(readable, {
			status: 206,
			headers: {
				...CORS,
				'Content-Type': 'application/vnd.pmtiles',
				'Content-Length': String(end - start + 1),
				'Content-Range': `bytes ${start}-${end}/${size}`,
				'Accept-Ranges': 'bytes',
				'Cache-Control': 'public, max-age=86400',
				...(asset.headers.get('ETag') ? { ETag: asset.headers.get('ETag') } : {})
			}
		});
	}
};
