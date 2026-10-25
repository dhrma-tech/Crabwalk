import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { session } from '#lib/server/auth.ts';
import { PHOTO_WIDTHS } from '#lib/server/listings.ts';
import { formBody } from '#lib/server/http.ts';
import type { RequestHandler } from './$types';

const meta = z.object({
	id: z.uuid(),
	entity_type: z.enum(['place', 'stay', 'eatery', 'dish']),
	entity_id: z.uuid(),
	is_hero: z.enum(['0', '1']),
	width: z.coerce.number().int().min(1).max(10000),
	height: z.coerce.number().int().min(1).max(10000),
	lqip: z.string().startsWith('data:image/webp;base64,').max(4000)
});

// POST /api/admin/photos (multipart) — verifier/owner photos only (no stock photos, BACKEND §3.3).
// Client already resized to WebP at 480/960/1600 (DECISIONS P4-2). Storage + photos RLS decide who may write.
export const POST: RequestHandler = async (event) => {
	const { user } = await session(event);
	const form = await formBody(event.request);
	const m = meta.safeParse(Object.fromEntries([...form].filter(([, v]) => typeof v === 'string')));
	if (!m.success) error(400, 'bad photo metadata');
	const { id, entity_type, entity_id } = m.data;
	const path = `${entity_type}/${entity_id}/${id}`;
	const storage = event.locals.supabase.storage.from('photos');

	for (const w of PHOTO_WIDTHS) {
		const f = form.get(`w${w}`);
		if (!(f instanceof File)) continue;
		if (f.type !== 'image/webp' || f.size > 3 * 1024 * 1024)
			error(400, 'photos must be WebP ≤ 3 MB');
		const { error: up } = await storage.upload(`${path}-${w}.webp`, f, {
			contentType: 'image/webp',
			upsert: true
		});
		if (up) error(403, 'upload not allowed');
	}
	const { error: err } = await event.locals.supabase.from('photos').upsert(
		{
			id,
			entity_type,
			entity_id,
			storage_path: path,
			lqip: m.data.lqip,
			width: m.data.width,
			height: m.data.height,
			uploaded_by: user.id,
			is_hero: m.data.is_hero === '1'
		},
		{ onConflict: 'id' }
	);
	if (err) error(403, 'photo not saved');
	return json({ id }, { status: 201 });
};
