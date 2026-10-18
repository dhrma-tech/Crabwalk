import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { CODE_RE } from '#lib/server/qr.ts';
import type { RequestHandler } from './$types';

const body = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

// POST /q/:code/visit {lat,lng} → verified_visits when within ~200 m. The DB computes the distance
// from the listing location (BACKEND §9: never trust client distance).
export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!(await locals.getUser())) error(401, 'sign in');
	const b = body.safeParse(await request.json().catch(() => null));
	if (!CODE_RE.test(params.code) || !b.success) error(400, 'bad request');
	const { data, error: err } = await locals.supabase
		.rpc('qr_verify_visit', { _code: params.code, _lat: b.data.lat, _lng: b.data.lng })
		.single();
	if (err)
		error(err.code === 'P0002' ? 404 : err.code === '42501' ? 401 : 400, 'visit not checked');
	return json(data);
};
