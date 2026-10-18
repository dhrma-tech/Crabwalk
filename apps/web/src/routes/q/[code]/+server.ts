import { redirect } from '@sveltejs/kit';
import { getLocale } from '#lib/paraglide/runtime.js';
import { renderQrMissing, renderQrPage } from '#lib/qr/page.ts';
import { CODE_RE, SESSION_COOKIE, resolveQr, sessionHash } from '#lib/server/qr.ts';
import type { Lang } from '#lib/server/listings.ts';
import type { RequestHandler } from './$types';

const html = (body: string, status = 200) =>
	new Response(body, {
		status,
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'private, no-cache',
			Vary: 'Cookie, Accept-Language'
		}
	});

// GET /q/:code (BACKEND §9): permanent short URL → standalone scan page with entity data inlined.
// Content comes from the listing, so editing it never needs a reprint. Station/bus-stand codes → /start.
export const GET: RequestHandler = async ({ params, locals, cookies, url }) => {
	const lang = getLocale() as Lang;
	const code = params.code.toUpperCase();
	if (!CODE_RE.test(code)) return html(renderQrMissing(lang), 404);
	if (code !== params.code) redirect(301, `/q/${code}`);

	// Anonymous scan session: random id in a 1-day cookie; only its hash is stored (DECISIONS P6-4).
	if (!cookies.get(SESSION_COOKIE))
		cookies.set(SESSION_COOKIE, crypto.randomUUID(), {
			path: '/q',
			maxAge: 86400,
			httpOnly: true,
			sameSite: 'lax'
		});

	const r = await resolveQr(locals.supabase, code, lang);
	if (r.type === 'missing') return html(renderQrMissing(lang), 404);
	if (r.type === 'start') {
		// No page here to run the scan beacon, so the redirect itself is the scan (no position).
		const id = cookies.get(SESSION_COOKIE);
		if (id)
			await locals.supabase.rpc('qr_record_scan', {
				_code: code,
				_session_hash: await sessionHash(id),
				_lang: lang
			});
		redirect(303, `/start?from=${code}`);
	}

	const time = (iso: string) =>
		new Intl.DateTimeFormat(`${lang}-IN`, {
			hour: 'numeric',
			minute: '2-digit',
			timeZone: 'Asia/Kolkata'
		}).format(new Date(iso));
	return html(renderQrPage(r.data, { lang, reported: url.searchParams.has('reported'), time }));
};
