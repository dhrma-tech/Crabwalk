import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { adminEditor, moderate } from '#lib/server/content.ts';
import type { RequestHandler } from './$types';

// Hide (or show again) abusive review text or a review photo. Votes, verdicts and counts are never edited here.
export const POST: RequestHandler = async (event) => {
	await adminEditor(event);
	const b = z
		.object({ kind: z.enum(['review', 'photo']), id: z.uuid(), hide: z.boolean() })
		.safeParse(await event.request.json().catch(() => null));
	if (!b.success) error(400, 'bad moderation');
	await moderate(b.data.kind, b.data.id, b.data.hide);
	return json({ ok: true });
};
