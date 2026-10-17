import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { session } from '#lib/server/auth.ts';
import { assertPublished } from '#lib/server/ratings.ts';
import type { RequestHandler } from './$types';

const meta = z.object({ entity_type: z.enum(['stay', 'eatery']), entity_id: z.uuid() });
const TYPES: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp'
};

// POST /api/booking-proofs (multipart) — G6: booking/bill screenshot → private bucket → verifier queue.
// The image is deleted on review or after 30 days at most.
export const POST: RequestHandler = async (event) => {
	const { user } = await session(event);
	const form = await event.request.formData();
	const m = meta.safeParse({
		entity_type: form.get('entity_type'),
		entity_id: form.get('entity_id')
	});
	const file = form.get('file');
	if (!m.success || !(file instanceof File) || !TYPES[file.type] || file.size > 5 << 20)
		error(400, 'bad request');
	const db = event.locals.supabase;
	if (!(await assertPublished(db, m.data.entity_type, m.data.entity_id))) error(404, 'not found');
	const path = `${user.id}/${crypto.randomUUID()}.${TYPES[file.type]}`;
	const { error: up } = await db.storage
		.from('booking-proofs')
		.upload(path, file, { contentType: file.type });
	if (up) error(403, 'upload failed');
	const { error: err } = await db
		.from('booking_proofs')
		.insert({ user_id: user.id, ...m.data, storage_path: path });
	if (err) error(400, 'not saved');
	return json({ status: 'pending' }, { status: 201 });
};
