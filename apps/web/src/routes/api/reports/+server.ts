import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const body = z.object({
	entity_type: z.enum(['place', 'stay', 'eatery']),
	entity_id: z.uuid(),
	type: z.enum(['broken_qr', 'garbage', 'unsafe_spot', 'wrong_info']),
	text: z.string().trim().max(1000).optional(),
	website: z.string().max(0).optional() // honeypot: bots fill it
});

// POST /api/reports — "Report a problem" (anon insert per RLS; throttled in the DB).
export const POST: RequestHandler = async ({ request, locals }) => {
	const b = body.safeParse(await request.json().catch(() => null));
	if (!b.success) error(400, 'bad request');
	const { entity_type, entity_id, type, text } = b.data;
	const row = { entity_type, entity_id, type, text };
	const { error: err } = await locals.supabase
		.from('reports')
		.insert({ ...row, text: row.text || null });
	if (err) error(err.code === '54000' ? 429 : 400, 'report not saved');
	return json({ ok: true }, { status: 201 });
};
