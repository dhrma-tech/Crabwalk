import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { serviceClient } from '#lib/server/service.ts';
import type { RequestHandler } from './$types';

const body = z.object({
	entity_type: z.enum(['place', 'stay', 'eatery']),
	entity_id: z.uuid(),
	type: z.enum(['broken_qr', 'garbage', 'unsafe_spot', 'wrong_info']),
	text: z.string().trim().max(1000).optional(),
	website: z.string().max(0).optional() // honeypot: bots fill it
});

// POST /api/reports — "Report a problem". No sign-in needed. The per-IP limit (rule `report`) runs in the hook;
// the row is written by file_report (service role only, SEC-05): known listing, length cap, hourly caps.
export const POST: RequestHandler = async ({ request }) => {
	const b = body.safeParse(await request.json().catch(() => null));
	if (!b.success) error(400, 'bad request');
	const { entity_type, entity_id, type, text } = b.data;
	const { error: err } = await serviceClient().rpc('file_report', {
		_type: entity_type,
		_id: entity_id,
		_kind: type,
		_text: text ?? ''
	});
	if (err) error(err.code === '54000' ? 429 : err.code === 'P0002' ? 404 : 400, 'report not saved');
	return json({ ok: true }, { status: 201 });
};
