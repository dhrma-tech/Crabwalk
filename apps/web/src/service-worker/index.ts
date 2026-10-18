import { self as sw } from '$app/service-worker';
import { immutable, assets, prerendered } from '$app/manifest';
import { version } from '$app/env';

// FRONTEND §9: precache the app shell (JS/CSS/fonts/icons); pages are network-first with the last good
// copy as offline fallback; published-content APIs are stale-while-revalidate (P4). Taluka packs in P9.
// Auth/prefs/staff/owner pages, POSTs and other origins (Supabase, Ola) are never cached here.
const SHELL = `shell-${version}`;
const PAGES = 'pages-v1';
const CONTENT = 'content-v1';
// P9: downloaded taluka packs (PMTiles + data) and saved trips' routes. Never evicted on update.
const PACKS = 'packs-v1';
const TRIPS = 'trips-v1';
const precache = [...immutable, ...assets, ...prerendered]
	.map((f) => '/' + f.path.replace(/^\//, ''))
	.filter((p) => p !== '/robots.txt')
	// Runtime public env module: client-only pages (e.g. /navigate) import it, so it is needed offline too.
	.concat('/_app/env.js');
const NO_CACHE = [
	'/auth',
	'/login',
	'/prefs',
	'/admin',
	'/owner',
	'/ola',
	'/api/admin',
	'/api/owner'
];
// Not pins (open-now is time-sensitive) and not tides (safety data, provider 24 h rule).
const PUBLISHED = /^\/api\/(places|stays|eateries|dishes|map\/utilities)(\/|$)/;

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(SHELL)
			.then((c) => c.addAll(precache))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((k) => ![SHELL, PAGES, CONTENT, PACKS, TRIPS].includes(k))
						.map((k) => caches.delete(k))
				)
			)
			.then(() => sw.clients.claim())
	);
});

/** Serve a cached pack file, honouring Range (PMTiles reads byte ranges). Anything else → network. */
async function fromPacks(req: Request) {
	const hit = await (await caches.open(PACKS)).match(req.url);
	if (!hit) return fetch(req);
	const range = /bytes=(\d+)-(\d*)/.exec(req.headers.get('range') ?? '');
	if (!range) return hit;
	const buf = await hit.arrayBuffer();
	const start = Number(range[1]);
	const end = range[2] ? Math.min(Number(range[2]), buf.byteLength - 1) : buf.byteLength - 1;
	return new Response(buf.slice(start, end + 1), {
		status: 206,
		headers: {
			'Content-Type': 'application/octet-stream',
			'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`,
			'Content-Length': String(end - start + 1)
		}
	});
}

sw.addEventListener('fetch', (event) => {
	const req = event.request;
	const url = new URL(req.url);
	// Downloaded taluka packs: tiles may live on the tiles host (other origin) — serve them offline-first.
	if (
		req.method === 'GET' &&
		(url.pathname.endsWith('.pmtiles') || /^\/api\/packs\/[^/]+\/data$/.test(url.pathname))
	) {
		event.respondWith(fromPacks(req));
		return;
	}
	if (req.method !== 'GET' || url.origin !== sw.location.origin) return;
	if (NO_CACHE.some((p) => url.pathname.startsWith(p))) return;

	if (precache.includes(url.pathname)) {
		// By pathname: prerendered client pages (/navigate?trip=…) are cached once for every query string.
		event.respondWith(caches.match(url.pathname).then((hit) => hit ?? fetch(req)));
		return;
	}

	// Saved trips' routes (shapes + turn cues): network-first, last copy kept for offline navigation.
	if (/^\/api\/trips\/[^/]+\/routes$/.test(url.pathname)) {
		event.respondWith(
			fetch(req)
				.then((res) => {
					if (res.ok) {
						const copy = res.clone();
						caches.open(TRIPS).then((c) => c.put(req, copy));
					}
					return res;
				})
				.catch(async () => (await (await caches.open(TRIPS)).match(req)) ?? Response.error())
		);
		return;
	}

	if (PUBLISHED.test(url.pathname)) {
		event.respondWith(
			caches.open(CONTENT).then(async (c) => {
				const hit = await c.match(req);
				const fresh = fetch(req)
					.then((res) => (res.ok && c.put(req, res.clone()), res))
					.catch(() => hit ?? Response.error());
				if (hit) event.waitUntil(fresh);
				return hit ?? fresh;
			})
		);
		return;
	}

	if (req.mode === 'navigate') {
		event.respondWith(
			fetch(req)
				.then((res) => {
					if (res.ok) {
						const copy = res.clone();
						caches.open(PAGES).then((c) => c.put(req, copy));
					}
					return res;
				})
				.catch(async () => {
					const pages = await caches.open(PAGES);
					return (
						(await pages.match(req)) ??
						// Prerendered client pages (e.g. /navigate?trip=…) work for any query string.
						(await caches.match(url.pathname)) ??
						(await pages.match('/')) ??
						new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain' } })
					);
				})
		);
	}
});

// Trip time nudges (DECISIONS P9-3): show the push; tapping it opens the live trip.
sw.addEventListener('push', (event) => {
	const d = (event.data?.json() ?? {}) as { title?: string; body?: string; url?: string };
	event.waitUntil(
		sw.registration.showNotification(d.title ?? 'Crabwalk', {
			body: d.body,
			icon: '/icons/icon-192.png',
			data: { url: d.url ?? '/' }
		})
	);
});

sw.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = (event.notification.data as { url?: string } | null)?.url ?? '/';
	event.waitUntil(sw.clients.openWindow(url));
});
