import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { session } from '#lib/server/auth.ts';
import { assertPublished, GROUPS } from '#lib/server/ratings.ts';
import { formBody } from '#lib/server/http.ts';
import type { RequestHandler } from './$types';

const meta = z.object({
	entity_type: z.enum(['place', 'stay', 'eatery']),
	entity_id: z.uuid(),
	group_type: z.enum(GROUPS),
	text: z.string().trim().max(2000).optional()
});
const MAX_PHOTOS = 4;

// POST /api/reviews (multipart) — text + up to 4 photos (client WebP 480/960 + LQIP). Lands as 'pending'
// (moderation queue; model check wired in P8). Re-posting edits the user's review for that group.
export const POST: RequestHandler = async (event) => {
	const { user } = await session(event);
	const form = await formBody(event.request);
	const m = meta.safeParse(Object.fromEntries([...form].filter(([, v]) => typeof v === 'string')));
	if (!m.success) error(400, 'bad request');
	const db = event.locals.supabase;
	if (!(await assertPublished(db, m.data.entity_type, m.data.entity_id))) error(404, 'not found');

	const { data: review, error: err } = await db
		.from('reviews')
		.upsert(
			{
				...m.data,
				text: m.data.text || null,
				user_id: user.id,
				moderation_status: 'pending',
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'user_id,entity_type,entity_id,group_type' }
		)
		.select('id')
		.single();
	if (err) error(err.code === '42501' ? 403 : 400, 'review not saved');

	const ids: string[] = [];
	for (let i = 0; i < MAX_PHOTOS; i++) {
		const w480 = form.get(`p${i}_480`);
		if (!(w480 instanceof File)) break;
		const w960 = form.get(`p${i}_960`);
		const lqip = String(form.get(`p${i}_lqip`) ?? '');
		if (
			w480.type !== 'image/webp' ||
			w480.size > 3 << 20 ||
			!lqip.startsWith('data:image/webp;base64,') ||
			lqip.length > 4000
		)
			error(400, 'bad photo');
		const id = crypto.randomUUID();
		const path = `${user.id}/${review.id}/${id}`;
		const storage = db.storage.from('review-photos');
		for (const [w, f] of [
			[480, w480],
			[960, w960]
		] as const) {
			if (!(f instanceof File) || f.type !== 'image/webp' || f.size > 3 << 20) continue;
			const { error: up } = await storage.upload(`${path}-${w}.webp`, f, {
				contentType: 'image/webp'
			});
			if (up) error(403, 'photo not saved');
		}
		const { error: pe } = await db.from('review_photos').insert({
			id,
			review_id: review.id,
			user_id: user.id,
			storage_path: path,
			lqip,
			width: Number(form.get(`p${i}_w`)) || null,
			height: Number(form.get(`p${i}_h`)) || null
		});
		if (pe) error(403, 'photo not saved');
		ids.push(id);
	}
	if (ids.length)
		await db
			.from('reviews')
			.update({ photo_ids: ids, moderation_status: 'pending' })
			.eq('id', review.id);
	return json({ id: review.id, status: 'pending' }, { status: 201 });
};
