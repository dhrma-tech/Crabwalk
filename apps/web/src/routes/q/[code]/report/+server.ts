import { error, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { CODE_RE } from '#lib/server/qr.ts';
import { formBody } from '#lib/server/http.ts';
import { serviceClient } from '#lib/server/service.ts';
import type { RequestHandler } from './$types';

const body = z.object({
	type: z.enum(['broken_qr', 'garbage', 'unsafe_spot', 'wrong_info']),
	text: z.string().trim().max(1000).optional(),
	website: z.string().max(0).optional() // honeypot
});

// POST /q/:code/report (plain form, works without JS) → reports with qr_code set → triage (B10).
// Anon allowed; throttled per IP in the hook and per listing / per hour in the DB.
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const b = body.safeParse(Object.fromEntries(await formBody(request)));
	if (!CODE_RE.test(params.code) || !b.success) error(400, 'bad request');
	const { data: q } = await locals.supabase
		.from('qr_codes')
		.select('entity_type, entity_id')
		.eq('code', params.code)
		.maybeSingle();
	if (!q) error(404, 'unknown code');
	// file_report is service-role only (SEC-05); the per-IP limit (rule `report`) already ran in the hook.
	const { error: err } = await serviceClient().rpc('file_report', {
		_type: q.entity_type,
		_id: q.entity_id,
		_kind: b.data.type,
		_text: b.data.text ?? '',
		_qr: params.code
	});
	if (err) error(err.code === '54000' ? 429 : err.code === 'P0002' ? 404 : 400, 'report not saved');
	redirect(303, `/q/${params.code}?reported=1#report`);
};
