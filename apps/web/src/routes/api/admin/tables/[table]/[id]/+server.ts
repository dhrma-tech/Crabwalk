import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { adminEditor } from '#lib/server/content.ts';
import { deleteRow, getRow, isTable, saveRow } from '#lib/server/tables.ts';
import type { RequestHandler } from './$types';

const target = (p: { table: string; id: string }) => {
	if (!isTable(p.table) || !z.uuid().safeParse(p.id).success) error(404);
	return { table: p.table, id: p.id };
};

export const PUT: RequestHandler = async (event) => {
	await adminEditor(event);
	const { table, id } = target(event.params);
	const b = z
		.object({ version: z.string().nullable(), values: z.record(z.string(), z.unknown()) })
		.safeParse(await event.request.json().catch(() => null));
	if (!b.success) error(400, 'bad row');
	const r = await saveRow(table, id, b.data.version, b.data.values);
	return json(r, { status: r.ok ? 200 : r.conflict ? 409 : 422 });
};

export const DELETE: RequestHandler = async (event) => {
	await adminEditor(event);
	const { table, id } = target(event.params);
	const b = z
		.object({ confirm: z.string() })
		.safeParse(await event.request.json().catch(() => null));
	if (!b.success || b.data.confirm.trim().toLowerCase() !== 'delete')
		error(400, 'type delete to confirm');
	if (!(await getRow(table, id))) error(404);
	await deleteRow(table, id);
	return json({ ok: true });
};
