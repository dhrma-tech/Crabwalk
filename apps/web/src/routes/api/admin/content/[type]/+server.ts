import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { TYPES } from '#lib/admin/fields.ts';
import { adminEditor, createEntry } from '#lib/server/content.ts';
import type { RequestHandler } from './$types';

const body = z.object({
	name_en: z.string().trim().min(2).max(120),
	taluka_id: z.uuid().nullish(),
	category: z.string().max(40).nullish()
});

// POST /api/admin/content/{type} — a new draft entry (admin cookie checked server-side; service role write).
export const POST: RequestHandler = async (event) => {
	const editor = await adminEditor(event);
	const type = z.enum(TYPES).safeParse(event.params.type);
	if (!type.success) error(404);
	const b = body.safeParse(await event.request.json().catch(() => null));
	if (!b.success) error(400, 'Name in English: 2–120 characters');
	return json({ id: await createEntry(type.data, b.data, editor) }, { status: 201 });
};
