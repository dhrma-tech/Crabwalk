import { redirect } from '@sveltejs/kit';
import { getLocale } from '#lib/paraglide/runtime.js';
import { SUPABASE_URL } from '$app/env/public';
import { qrCsp, renderQrMissing, renderQrPage } from '#lib/qr/page.ts';
import { CODE_RE, SESSION_COOKIE, resolveQr, sessionHash } from '#lib/server/qr.ts';
import type { Lang } from '#lib/server/listings.ts';
import { tempGate } from '#lib/server/gate.ts';
import { VISIT_COOKIE, VISIT_TTL_S, signVisit } from '#lib/server/qrVisit.ts';
import { clientKey } from '#lib/server/rate.ts';
import { serviceClient } from '#lib/server/service.ts';
import type { RequestHandler } from './$types';

let csp: Promise<string> | undefined;
const html = async (body: string, status = 200) =>
	new Response(body, {
		status,
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'private, no-cache',
			Vary: 'Cookie, Accept-Language',
			'Content-Security-Policy': await (csp ??= qrCsp(
				new URL(SUPABASE_URL ?? 'http://localhost').origin
			))
		}
	});

// GET /q/:code (BACKEND §9): permanent short URL → standalone scan page with entity data inlined.
// Content comes from the listing, so editing it never needs a reprint. Station/bus-stand codes → /start.
export const GET: RequestHandler = async (event) => {
	const { params, locals, cookies, url } = event;
	const lang = getLocale() as Lang;
	const code = params.code.toUpperCase();
	if (!CODE_RE.test(code)) return html(renderQrMissing(lang), 404);
	if (code !== params.code) redirect(301, `/q/${code}`);

	// Anonymous scan session: random id in a 1-day cookie; only its hash is stored (DECISIONS P6-4).
	let sid = cookies.get(SESSION_COOKIE);
	if (!sid)
		cookies.set(SESSION_COOKIE, (sid = crypto.randomUUID()), {
			path: '/q',
			maxAge: 86400,
			httpOnly: true,
			sameSite: 'lax'
		});

	const r = await resolveQr(locals.supabase, code, lang);
	if (r.type === 'missing') return html(renderQrMissing(lang), 404);
	if (r.type === 'start') {
		// No page here to run the scan beacon, so the redirect itself is the scan (no position).
		const id = sid;
		// Server-only RPC (SEC-04). A missing key or salt must never break a printed code: skip the scan.
		if (id)
			try {
				await serviceClient().rpc('qr_record_scan', {
					_code: code,
					_session_hash: await sessionHash(id),
					_lang: lang,
					_client_key: await clientKey(event, 'qr-scan')
				});
			} catch {
				console.warn(JSON.stringify({ event: 'qr_scan_skipped', code }));
			}
		redirect(303, `/start?from=${code}`);
	}

	// Scan token (SEC-03): proof that this browser loaded this code's page; POST /q/:code/visit requires it.
	// A missing salt must never break a printed code: without the cookie only "Verify visit" is refused.
	try {
		cookies.set(VISIT_COOKIE, await signVisit(code, sid), {
			path: '/q',
			maxAge: VISIT_TTL_S,
			httpOnly: true,
			sameSite: 'lax'
		});
	} catch {
		console.warn(JSON.stringify({ event: 'qr_visit_token_skipped', code }));
	}

	const time = (iso: string) =>
		new Intl.DateTimeFormat(`${lang}-IN`, {
			hour: 'numeric',
			minute: '2-digit',
			timeZone: 'Asia/Kolkata'
		}).format(new Date(iso));
	return html(
		renderQrPage(r.data, {
			lang,
			reported: url.searchParams.has('reported'),
			time,
			// TODO(before-deploy): restore full auth — temp gate: /guest creates the guest session and comes back.
			signIn: tempGate() ? `/guest?next=${encodeURIComponent(`/q/${code}`)}` : '/login'
		})
	);
};
