import { error, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { CODE_RE } from '#lib/server/qr.ts';
import { formBody } from '#lib/server/http.ts';
import type { RequestHandler } from './$types';

const body = z.object({
	type: z.enum(['broken_qr', 'garbage', 'unsafe_spot', 'wrong_info']),
	text: z.string().trim().max(1000).optional(),
	website: z.string().max(0).optional() // honeypot
});

// POST /q/:code/report (plain form, works without JS) → reports with qr_code set → triage (B10).
// Anon allowed; throttled in the DB (P4-3).
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const b = body.safeParse(Object.fromEntries(await formBody(request)));
	if (!CODE_RE.test(params.code) || !b.success) error(400, 'bad request');
	const { data: q } = await locals.supabase
		.from('qr_codes')
		.select('entity_type, entity_id')
		.eq('code', params.code)
		.maybeSingle();
	if (!q) error(404, 'unknown code');
	const { error: err } = await locals.supabase.from('reports').insert({
		...q,
		qr_code: params.code,
		type: b.data.type,
		text: b.data.text || null
	});
	if (err) error(err.code === '54000' ? 429 : 400, 'report not saved');
	redirect(303, `/q/${params.code}?reported=1#report`);
};
