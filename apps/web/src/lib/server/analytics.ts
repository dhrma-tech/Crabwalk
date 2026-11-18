import type { RequestEvent } from '@sveltejs/kit';
import { getLocale } from '#lib/paraglide/runtime.js';
import type { EventName, Props } from '#lib/analytics.ts';
import { clientKey, hmac } from './rate.ts';
import { serviceClient } from './service.ts';

// Hardening T1-11: one event row. The session hash is HMAC(salt, client key + IST date): the same visitor on the
// same day groups together, nothing identifies them, and it changes every day. A browser that sends DNT: 1 is not
// recorded. Never throws: analytics must not break a page (local dev has no service key). On Cloudflare the write
// finishes after the response (`waitUntil`), so a page never waits for it.
const istDate = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

async function store(event: RequestEvent, name: EventName, props: Props, route: string | null) {
	try {
		const session = await hmac(`${await clientKey(event, 'analytics')}:${istDate()}`);
		await serviceClient().rpc('log_analytics_event', {
			_name: name,
			_props: props,
			_session_hash: session,
			_lang: getLocale(),
			// The generated types mark every argument non-null; the column takes null.
			_route: (route?.slice(0, 120) ?? null) as string
		});
	} catch {
		// no service client here, or the database is unreachable
	}
}

export function logEvent(
	event: RequestEvent,
	name: EventName,
	props: Props = {},
	route: string | null = event.route.id
): Promise<void> {
	if (event.request.headers.get('dnt') === '1') return Promise.resolve();
	const job = store(event, name, props, route);
	event.platform?.ctx?.waitUntil?.(job);
	return job;
}
