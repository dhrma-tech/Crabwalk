import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { TYPES } from '#lib/admin/fields.ts';
import {
	adminEditor,
	deleteForever,
	getEntry,
	saveEntry,
	setArchived,
	setStatus,
	type SaveResult
} from '#lib/server/content.ts';
import type { RequestHandler } from './$types';

// /api/admin/content/{type}/{id} — the admin editor. Every method checks the admin first (signed cookie in temp
// mode), then writes with the service role. Conflicts (someone saved in between) come back as 409 with their row.
const params = (p: { type: string; id: string }) => {
	const t = z.enum(TYPES).safeParse(p.type);
	const id = z.uuid().safeParse(p.id);
	if (!t.success || !id.success) error(404);
	return { type: t.data, id: id.data };
};
const reply = (r: SaveResult) =>
	r.ok ? json(r) : 'conflict' in r ? json(r, { status: 409 }) : json(r, { status: 422 });

export const GET: RequestHandler = async (event) => {
	await adminEditor(event);
	const { type, id } = params(event.params);
	const entry = await getEntry(type, id);
	if (!entry) error(404);
	return json(entry);
};

const save = z.object({
	version: z.string().nullable(),
	changes: z.record(z.string(), z.unknown()).default({}),
	rows: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))).default({})
});
export const PUT: RequestHandler = async (event) => {
	const editor = await adminEditor(event);
	const { type, id } = params(event.params);
	const b = save.safeParse(await event.request.json().catch(() => null));
	if (!b.success) error(400, 'bad save body');
	return reply(await saveEntry(type, id, b.data, editor));
};

const act = z.discriminatedUnion('action', [
	z.object({
		action: z.literal('status'),
		version: z.string().nullable(),
		to: z.enum(['draft', 'in_review', 'published'])
	}),
	z.object({ action: z.literal('archive'), version: z.string().nullable() }),
	z.object({ action: z.literal('restore'), version: z.string().nullable() })
]);
export const POST: RequestHandler = async (event) => {
	const editor = await adminEditor(event);
	const { type, id } = params(event.params);
	const b = act.safeParse(await event.request.json().catch(() => null));
	if (!b.success) error(400, 'bad action');
	const a = b.data;
	return reply(
		a.action === 'status'
			? await setStatus(type, id, a.version, a.to, editor)
			: await setArchived(type, id, a.version, a.action === 'archive', editor)
	);
};

export const DELETE: RequestHandler = async (event) => {
	await adminEditor(event);
	const { type, id } = params(event.params);
	const b = z
		.object({ confirm: z.string().max(200) })
		.safeParse(await event.request.json().catch(() => null));
	if (!b.success) error(400, 'type the entry name to confirm');
	await deleteForever(type, id, b.data.confirm);
	return json({ ok: true });
};
