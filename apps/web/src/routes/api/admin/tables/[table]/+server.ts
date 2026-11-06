import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { adminEditor } from '#lib/server/content.ts';
import { createRow, isTable } from '#lib/server/tables.ts';
import type { RequestHandler } from './$types';

// POST /api/admin/tables/{table} — new row in one of the other content tables (admin first, service role).
export const POST: RequestHandler = async (event) => {
	await adminEditor(event);
	if (!isTable(event.params.table)) error(404);
	const b = z
		.object({ values: z.record(z.string(), z.unknown()) })
		.safeParse(await event.request.json().catch(() => null));
	if (!b.success) error(400, 'bad row');
	const r = await createRow(event.params.table, b.data.values);
	return json(r, { status: r.ok ? 201 : 422 });
};
