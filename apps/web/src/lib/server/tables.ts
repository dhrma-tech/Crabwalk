// Admin editor for the other content tables, built from the live schema (admin_table_columns): alerts, team Q&A,
// user reports, ready-made itineraries (published routes), QR plaques, events and utility points. Service role,
// after adminEditor(). Optimistic lock on updated_at, like the listing editor. Geometry columns are read-only here
// (alerts and utility points keep their own map tools).
import { error } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { serviceClient } from './service.ts';

type DB = SupabaseClient;
type Row = Record<string, unknown>;
const svc = () => serviceClient() as unknown as DB;

import { TABLES, isTable, type TableName } from '#lib/admin/tables.ts';
export { TABLES, isTable, type TableName };

export type Column = {
	column_name: string;
	data_type: string;
	udt_name: string;
	nullable: boolean;
	has_default: boolean;
	enum_values: string[] | null;
};
const SYSTEM = new Set(['id', 'created_at', 'updated_at']);
export const readOnly = (c: Column) =>
	SYSTEM.has(c.column_name) || c.udt_name === 'geography' || c.udt_name === 'geometry';

export async function columns(table: TableName, db: DB = svc()) {
	const { data, error: e } = await db.rpc('admin_table_columns', { _table: table });
	if (e) error(500, e.message);
	return (data ?? []) as Column[];
}

/** Form value → column value, by the column's type. '' → null (Unknown). */
export function coerce(c: Column, v: unknown): unknown {
	if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) return null;
	const s = typeof v === 'string' ? v.trim() : v;
	switch (c.udt_name) {
		case 'int2':
		case 'int4':
		case 'int8': {
			const n = Number(s);
			if (!Number.isInteger(n)) throw new Error(`${c.column_name}: whole number`);
			return n;
		}
		case 'numeric':
		case 'float4':
		case 'float8': {
			const n = Number(s);
			if (!Number.isFinite(n)) throw new Error(`${c.column_name}: number`);
			return n;
		}
		case 'bool':
			if (typeof s === 'boolean') return s;
			if (s === 'true' || s === 'false') return s === 'true';
			throw new Error(`${c.column_name}: Yes / No / Unknown`);
		case 'jsonb':
		case 'json':
			if (typeof s !== 'string') return s;
			try {
				return JSON.parse(s);
			} catch {
				throw new Error(`${c.column_name}: valid JSON`);
			}
		case '_text':
			return Array.isArray(s)
				? s
				: String(s)
						.split('\n')
						.map((x) => x.trim())
						.filter(Boolean);
		case 'date':
			if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) throw new Error(`${c.column_name}: YYYY-MM-DD`);
			return s;
		case 'timestamptz':
			if (isNaN(Date.parse(String(s)))) throw new Error(`${c.column_name}: date and time`);
			return new Date(String(s)).toISOString();
	}
	if (c.enum_values && !c.enum_values.includes(String(s)))
		throw new Error(`${c.column_name}: pick a listed value`);
	return s;
}

export async function listRows(table: TableName, db: DB = svc()) {
	const { data, error: e } = await db
		.from(table)
		.select('*')
		.order('created_at', { ascending: false })
		.limit(500);
	if (e) error(500, e.message);
	return (data ?? []) as Row[];
}

export async function getRow(table: TableName, id: string, db: DB = svc()) {
	const { data } = await db.from(table).select('*').eq('id', id).maybeSingle();
	return (data as Row) ?? null;
}

function prepare(cols: Column[], values: Row) {
	const out: Row = {};
	const errors: Record<string, string> = {};
	for (const [k, v] of Object.entries(values)) {
		const c = cols.find((x) => x.column_name === k);
		if (!c || readOnly(c)) continue;
		try {
			const val = coerce(c, v);
			if (val === null && !c.nullable && !c.has_default) errors[k] = 'Required';
			else if (!(val === null && !c.nullable)) out[k] = val;
		} catch (e) {
			errors[k] = (e as Error).message;
		}
	}
	return { out, errors };
}

export async function saveRow(
	table: TableName,
	id: string,
	version: string | null,
	values: Row,
	db: DB = svc()
): Promise<
	| { ok: true; row: Row }
	| { ok: false; conflict?: Row; errors?: Record<string, string>; message?: string }
> {
	const cur = await getRow(table, id, db);
	if (!cur) error(404, 'row not found');
	if ((cur.updated_at ?? null) !== version) return { ok: false, conflict: cur };
	const { out, errors } = prepare(await columns(table, db), values);
	if (Object.keys(errors).length) return { ok: false, errors };
	let q = db.from(table).update(out).eq('id', id);
	q = version ? q.eq('updated_at', version) : q.is('updated_at', null);
	const { data, error: e } = await q.select('*');
	if (e) return { ok: false, message: e.message };
	if (!data?.length) return { ok: false, conflict: (await getRow(table, id, db)) ?? undefined };
	return { ok: true, row: data[0] as Row };
}

export async function createRow(table: TableName, values: Row, db: DB = svc()) {
	const { out, errors } = prepare(await columns(table, db), values);
	if (Object.keys(errors).length) return { ok: false as const, errors };
	const { data, error: e } = await db.from(table).insert(out).select('id').single();
	if (e) return { ok: false as const, message: e.message };
	return { ok: true as const, id: (data as Row).id as string };
}

/** Archive where the table has a status of its own (events: draft = hidden); everything else is edit or delete. */
export const archivable = (cols: Column[]) =>
	cols.some((c) => c.column_name === 'status' && c.udt_name === 'content_status');

export async function deleteRow(table: TableName, id: string, db: DB = svc()) {
	// QR codes: their scans and reports point at the code without a cascade.
	if (table === 'qr_codes') {
		const row = await getRow(table, id, db);
		if (row) {
			await db
				.from('reports')
				.delete()
				.eq('qr_code', row.code as string);
			await db
				.from('qr_scans')
				.delete()
				.eq('code', row.code as string);
		}
	}
	const { error: e } = await db.from(table).delete().eq('id', id);
	if (e) error(400, e.message);
}
