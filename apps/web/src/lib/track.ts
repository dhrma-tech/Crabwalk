import { page } from '$app/state';
import type { EventName, Props } from '#lib/analytics.ts';

// Hardening T1-11: fire-and-forget event to our own server (/api/e). Do Not Track → nothing is sent.
// The route is the page's route id (e.g. "/place/[slug]"), never the address with its slug or query.
export function track(name: EventName, props: Props = {}) {
	if (typeof navigator === 'undefined' || navigator.doNotTrack === '1') return;
	const body = JSON.stringify({ name, props, route: page.route.id });
	try {
		if (navigator.sendBeacon?.('/api/e', new Blob([body], { type: 'application/json' }))) return;
	} catch {
		// fall through to fetch
	}
	void fetch('/api/e', {
		method: 'POST',
		body,
		keepalive: true,
		headers: { 'content-type': 'application/json' }
	}).catch(() => {});
}
