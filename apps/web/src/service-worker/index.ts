import { self as sw } from '$app/service-worker';
import { immutable, assets } from '$app/manifest';
import { version } from '$app/env';

// FRONTEND §9 (P2 shell): precache the app shell (JS/CSS/fonts/icons); pages are network-first
// with the last good copy as offline fallback. Published-content runtime cache comes with content (P4),
// taluka packs in P9. Auth/prefs/POSTs and other origins (Supabase, Ola) are never cached here.
const SHELL = `shell-${version}`;
const PAGES = 'pages-v1';
const precache = [...immutable, ...assets]
	.map((f) => '/' + f.path.replace(/^\//, ''))
	.filter((p) => p !== '/robots.txt');
const NO_CACHE = ['/auth', '/login', '/prefs'];

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
				Promise.all(keys.filter((k) => k !== SHELL && k !== PAGES).map((k) => caches.delete(k)))
			)
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const req = event.request;
	const url = new URL(req.url);
	if (req.method !== 'GET' || url.origin !== sw.location.origin) return;
	if (NO_CACHE.some((p) => url.pathname.startsWith(p))) return;

	if (precache.includes(url.pathname)) {
		event.respondWith(caches.match(req).then((hit) => hit ?? fetch(req)));
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
						(await pages.match('/')) ??
						new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain' } })
					);
				})
		);
	}
});
