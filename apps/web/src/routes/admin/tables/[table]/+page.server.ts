import { error } from '@sveltejs/kit';
import { adminEditor } from '#lib/server/content.ts';
import { TABLES, archivable, columns, isTable, listRows, readOnly } from '#lib/server/tables.ts';
import type { PageServerLoad } from './$types';

// Other content tables, edited from the live schema (admin checked server-side; service role).
export const load: PageServerLoad = async (event) => {
	await adminEditor(event);
	const table = event.params.table;
	if (!isTable(table)) error(404);
	const [cols, rows] = await Promise.all([columns(table), listRows(table)]);
	// Geometry is shown as text only; the hex value is no use to a person.
	const shown = rows.map((r) =>
		Object.fromEntries(
			Object.entries(r).map(([k, v]) => {
				const c = cols.find((x) => x.column_name === k);
				return [
					k,
					c && (c.udt_name === 'geography' || c.udt_name === 'geometry') ? '(map shape)' : v
				];
			})
		)
	);
	return {
		table,
		label: TABLES[table],
		cols: cols.map((c) => ({ ...c, readOnly: readOnly(c) })),
		rows: shown,
		archivable: archivable(cols)
	};
};
