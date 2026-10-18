import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { getLocale } from '#lib/paraglide/runtime.js';
import { CODE_RE, SESSION_COOKIE, sessionHash } from '#lib/server/qr.ts';
import type { Lang } from '#lib/server/listings.ts';
import type { RequestHandler } from './$types';

const body = z.union([
	z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
	z.object({}).strict()
]);

// POST /q/:code/scan → qr_scans (live crowd + heatmap). No user id; position only if the user already allowed it.
export const POST: RequestHandler = async ({ params, request, cookies, locals }) => {
	const b = body.safeParse(await request.json().catch(() => null));
	const id = cookies.get(SESSION_COOKIE);
	if (!CODE_RE.test(params.code) || !b.success || !id) error(400, 'bad request');
	const pos = 'lat' in b.data ? b.data : null;
	const { error: err } = await locals.supabase.rpc('qr_record_scan', {
		_code: params.code,
		_session_hash: await sessionHash(id),
		_lang: getLocale() as Lang,
		...(pos ? { _lat: pos.lat, _lng: pos.lng } : {})
	});
	if (err) error(400, 'scan not saved');
	return new Response(null, { status: 204 });
};
