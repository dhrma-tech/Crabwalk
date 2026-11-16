// Structured logs and security events (hardening 2026-11, SEC-16). One JSON line per event with the request id
// (hooks.server.ts) and route; security-relevant ones also go to public.security_events (service role, kept 90
// days, listed on /admin/security). Never put an email, a passcode, a token or an IP in `fields`: use hashes
// (the limiter's client key, SHA-256 of an email).
import type { RequestEvent } from '@sveltejs/kit';
import { serviceClient } from './service.ts';

type Ev = Pick<RequestEvent, 'locals' | 'route'> | null | undefined;

export function log(event: string, fields: Record<string, unknown> = {}, ev?: Ev, status?: number) {
	console.log(
		JSON.stringify({
			ts: new Date().toISOString(),
			event,
			rid: ev?.locals.rid ?? null,
			route: ev?.route.id ?? null,
			...(status ? { status } : {}),
			...fields
		})
	);
}

/** log() plus one security_events row. Best effort: a failed insert never breaks the request. */
export async function securityEvent(
	kind: string,
	detail: Record<string, unknown> = {},
	ev?: Ev,
	clientKey?: string
) {
	log(kind, detail, ev);
	try {
		await serviceClient().rpc('log_security_event', {
			_kind: kind,
			_client_key: clientKey && /^[0-9a-f]{64}$/.test(clientKey) ? clientKey : undefined,
			_detail: { ...detail, route: ev?.route.id ?? null }
		});
	} catch {
		// no service key (local dev) or database down: the log line above is the record
	}
}
