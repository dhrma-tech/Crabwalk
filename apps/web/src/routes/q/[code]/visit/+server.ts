import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { CODE_RE, SESSION_COOKIE } from '#lib/server/qr.ts';
import { VISIT_COOKIE, checkVisit } from '#lib/server/qrVisit.ts';
import { clientKey } from '#lib/server/rate.ts';
import { serviceClient } from '#lib/server/service.ts';
import type { RequestHandler } from './$types';

const body = z.object({
	lat: z.number().min(-90).max(90),
	lng: z.number().min(-180).max(180),
	acc: z.number().min(0).max(1e7)
});

// POST /q/:code/visit {lat,lng,acc} → verified_visits when within ~200 m. The DB computes the distance from the
// listing location (BACKEND §9: never trust client distance). Hardening 2026-11 (SEC-03): the RPC is
// service-role only; the browser must hold the signed scan cookie from GET /q/:code (at most 30 minutes old),
// and the DB refuses poor GPS accuracy and impossible travel.
export const POST: RequestHandler = async (event) => {
	const { params, request, locals, cookies } = event;
	const user = await locals.getUser();
	if (!user) error(401, 'sign in');
	const b = body.safeParse(await request.json().catch(() => null));
	if (!CODE_RE.test(params.code) || !b.success) error(400, 'bad request');
	if (!(await checkVisit(cookies.get(VISIT_COOKIE), params.code, cookies.get(SESSION_COOKIE))))
		error(403, 'scan the code first');
	const { data, error: err } = await serviceClient()
		.rpc('qr_verify_visit', {
			_user: user.id,
			_code: params.code,
			_lat: b.data.lat,
			_lng: b.data.lng,
			_accuracy: Math.round(b.data.acc),
			_client_key: await clientKey(event, 'qr-visit')
		})
		.single();
	if (err) error(err.code === 'P0002' ? 404 : 400, 'visit not checked');
	return json(data);
};
