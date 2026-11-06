import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { TYPES } from '#lib/admin/fields.ts';
import { formBody } from '#lib/server/http.ts';
import { creditInput } from '#lib/server/photoCredit.ts';
import {
	addPhoto,
	adminEditor,
	arrangePhotos,
	editorUserId,
	getEntry,
	removePhoto,
	setPhotoCredit
} from '#lib/server/content.ts';
import type { RequestHandler } from './$types';

// Photos per form slot (hero, card, gallery, rooms, menu, …). The browser already compressed them to WebP at
// 480/960/1600 (lib/field/photos.ts). Admin checked first; service role writes.
const params = (p: { type: string; id: string }) => {
	const t = z.enum(TYPES).safeParse(p.type);
	const id = z.uuid().safeParse(p.id);
	if (!t.success || !id.success) error(404);
	return { type: t.data, id: id.data };
};
const fresh = async (type: (typeof TYPES)[number], id: string) => json(await getEntry(type, id));

const meta = z.object({
	photo_id: z.uuid(),
	slot: z.string().max(20),
	width: z.coerce.number().int().min(1).max(10000),
	height: z.coerce.number().int().min(1).max(10000),
	lqip: z.string().startsWith('data:image/webp;base64,').max(4000),
	replace: z.uuid().optional()
});

export const POST: RequestHandler = async (event) => {
	await adminEditor(event);
	const { type, id } = params(event.params);
	const form = await formBody(event.request);
	const m = meta.safeParse(Object.fromEntries([...form].filter(([, v]) => typeof v === 'string')));
	if (!m.success) error(400, 'bad photo metadata');
	const credit = creditInput.safeParse({
		credit: String(form.get('credit') ?? ''),
		licence: String(form.get('licence') ?? ''),
		source_url: String(form.get('source_url') ?? '')
	});
	if (!credit.success) error(400, 'photo credit: author, licence and source together');
	const files: [number, File][] = [];
	for (const w of [480, 960, 1600]) {
		const f = form.get(`w${w}`);
		if (!(f instanceof File)) continue;
		if (f.type !== 'image/webp' || f.size > 3 * 1024 * 1024)
			error(400, 'photos must be WebP ≤ 3 MB');
		files.push([w, f]);
	}
	if (!files.length) error(400, 'no photo');
	await addPhoto(
		type,
		id,
		{
			photoId: m.data.photo_id,
			slot: m.data.slot,
			width: m.data.width,
			height: m.data.height,
			lqip: m.data.lqip,
			files,
			credit: credit.data,
			replace: m.data.replace ?? null
		},
		await editorUserId(event)
	);
	return fresh(type, id);
};

const patch = z.union([
	z.object({ order: z.array(z.object({ id: z.uuid(), slot: z.string().max(20) })).max(60) }),
	z.object({
		photo: z.uuid(),
		credit: z.string(),
		licence: z.string(),
		source_url: z.string()
	})
]);
export const PATCH: RequestHandler = async (event) => {
	await adminEditor(event);
	const { type, id } = params(event.params);
	const b = patch.safeParse(await event.request.json().catch(() => null));
	if (!b.success) error(400, 'bad photo change');
	if ('order' in b.data) await arrangePhotos(type, id, b.data.order);
	else {
		const c = creditInput.safeParse(b.data);
		if (!c.success) error(400, 'photo credit: author, licence and source together');
		await setPhotoCredit(id, b.data.photo, c.data);
	}
	return fresh(type, id);
};

export const DELETE: RequestHandler = async (event) => {
	await adminEditor(event);
	const { type, id } = params(event.params);
	const b = z.object({ photo: z.uuid() }).safeParse(await event.request.json().catch(() => null));
	if (!b.success) error(400, 'which photo?');
	await removePhoto(type, id, b.data.photo);
	return fresh(type, id);
};
