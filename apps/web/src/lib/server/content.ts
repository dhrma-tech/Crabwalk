// Admin editor, server side (ADMIN_ACCESS_CHANGES.md). Every function here runs with the service role and is only
// called from routes that checked the admin first (adminEditor below). Reads build the flat value map the form
// edits (lib/admin/fields.ts); saves are patches with optimistic locking on the listing row's updated_at.
import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from '$app/env/public';
import {
	DEFS,
	TABLE,
	TR_TABLE,
	LANGS,
	MONTHS,
	allFields,
	photoFileName,
	type EntryType,
	type Field
} from '#lib/admin/fields.ts';
import {
	completeness,
	isEmpty,
	missingRequired,
	normalize,
	recheckFrom,
	validate,
	validateRows,
	type Missing,
	type Rows,
	type Values
} from '#lib/admin/validate.ts';
import { lonLat } from './listings.ts';
import { gateAdmin, tempGate } from './gate.ts';
import { requireStaff } from './auth.ts';
import { serviceClient } from './service.ts';

// Dynamic table names: the typed client can't follow them, so the editor uses the untyped view of it.
type DB = SupabaseClient;
type Row = Record<string, unknown>;
const svc = () => serviceClient() as unknown as DB;

// ---------------------------------------------------------------- who is editing
/**
 * The admin's email after the server-side check. Temp mode: the signed admin cookie (TODO(before-deploy): restore
 * full auth). Full mode: an admin role on a real session. Pages go to the gate, APIs get 401.
 */
export async function adminEditor(event: Pick<RequestEvent, 'locals' | 'url' | 'cookies'>) {
	if (tempGate()) {
		const email = await gateAdmin(event);
		if (email) return email;
		if (event.url.pathname.startsWith('/api/')) error(401, 'admin sign-in needed');
		redirect(303, '/me?admin=1');
	}
	const s = await requireStaff(event, 'admin');
	return s.user.email ?? s.user.id;
}

/** Auth user id for rows that need one (photos.uploaded_by): the admin's own Supabase session. */
export async function editorUserId(event: Pick<RequestEvent, 'locals'>) {
	const u = await event.locals.getUser();
	if (!u) error(401, 'session needed');
	return u.id;
}

// ---------------------------------------------------------------- shapes
const TR_FIELDS = {
	place: ['name', 'short_story', 'history', 'significance', 'dos', 'donts', 'safety_text'],
	stay: ['name', 'description'],
	eatery: ['name', 'description'],
	dish: ['name', 'what_it_is', 'story']
} as const;
const FK = { place: 'place_id', stay: 'stay_id', eatery: 'eatery_id', dish: 'dish_id' } as const;
const DATE_TS = new Set(['last_verified_at', 'next_recheck_at']); // timestamptz shown as a date

export type Photo = {
	id: string;
	slot: string | null;
	sort_order: number;
	file_name: string | null;
	width: number | null;
	height: number | null;
	credit: string | null;
	licence: string | null;
	source_url: string | null;
	thumb: string;
};
export type Status = 'draft' | 'in_review' | 'published';
export type Entry = {
	type: EntryType;
	id: string;
	version: string | null;
	status: Status;
	archived_at: string | null;
	last_edited_by: string | null;
	last_edited_at: string | null;
	owner_id: string | null;
	name: string;
	code: string | null;
	taluka_id: string | null;
	values: Values;
	rows: Rows;
	photos: Photo[];
	missing: Missing[];
	percent: number;
};

const istDate = (ts: unknown) =>
	typeof ts === 'string' && ts
		? new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
		: null;
/** A date typed in the form, stored at IST midday so the day never shifts. */
const dateTs = (d: unknown) => (typeof d === 'string' && d ? `${d}T12:00:00+05:30` : null);
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
const todayIst = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

function deep(obj: unknown, path: string[]): unknown {
	let cur = obj;
	for (const p of path) {
		if (!cur || typeof cur !== 'object') return null;
		cur = (cur as Row)[p];
	}
	return cur ?? null;
}

/** DB rows → the form's flat value map. */
function toValues(type: EntryType, row: Row, trs: Row[], form: Row, priv: Row, team: Row): Values {
	const v: Values = {};
	for (const f of allFields(type)) {
		const k = f.key;
		if (k === 'gps') {
			const ll = lonLat(row.location);
			v[k] = ll ? { lat: r6(ll[1]), lng: r6(ll[0]) } : null;
		} else if (k.startsWith('tr.')) {
			const [, lang, field] = k.split('.');
			v[k] = trs.find((t) => t.lang === lang)?.[field!] ?? null;
		} else if (k.startsWith('form.')) v[k] = form[k.slice(5)] ?? null;
		else if (k.startsWith('private.')) v[k] = priv[k.slice(8)] ?? null;
		else if (k.startsWith('team.')) v[k] = team[k.slice(5)] ?? null;
		else if (k === 'menu.items')
			v[k] = ((deep(row.menu, ['items']) as unknown[]) ?? []).filter((x) => typeof x === 'string');
		else if (k.includes('.')) {
			const val = deep(row[k.split('.')[0]!], k.split('.').slice(1));
			v[k] = f.kind === 'tri' ? (typeof val === 'boolean' ? val : null) : (val ?? null);
		} else if (DATE_TS.has(k)) v[k] = istDate(row[k]);
		else
			v[k] = row[k] ?? (f.kind === 'multi' || f.kind === 'lines' || f.kind === 'urls' ? [] : null);
	}
	return v;
}

const hm = (t: unknown) => (typeof t === 'string' && t ? t.slice(0, 5) : null);
const monthName = (n: unknown) => (typeof n === 'number' ? (MONTHS[n - 1] ?? null) : null);

async function loadRows(db: DB, type: EntryType, id: string, form: Row): Promise<Rows> {
	const rows: Rows = {};
	for (const r of DEFS[type].repeats) {
		if (r.store === 'form') {
			rows[r.key] = Array.isArray(form[r.key]) ? (form[r.key] as Row[]) : [];
			continue;
		}
		const key = `${type}.${r.key}`;
		if (key === 'place.hours' || key === 'eatery.hours') {
			const { data } = await db
				.from(type === 'place' ? 'place_hours' : 'eatery_hours')
				.select('weekday, opens, closes, hours_unknown')
				.eq(FK[type], id)
				.order('weekday')
				.order('opens');
			rows[r.key] = (data ?? []).map((h) => ({ ...h, opens: hm(h.opens), closes: hm(h.closes) }));
		} else if (key === 'place.seasonal') {
			const { data } = await db
				.from('place_seasonal')
				.select('season, from_month, to_month')
				.eq('place_id', id);
			rows[r.key] = (data ?? []).map((s) => ({
				season: s.season,
				from_month: monthName(s.from_month),
				to_month: monthName(s.to_month)
			}));
		} else if (key === 'place.crowd') {
			const { data } = await db
				.from('crowd_typical')
				.select('weekday, season, level')
				.eq('place_id', id)
				.order('weekday');
			rows[r.key] = data ?? [];
		} else if (key === 'stay.offers') {
			const { data } = await db.from('stay_offers').select('provider, deep_link').eq('stay_id', id);
			rows[r.key] = data ?? [];
		} else if (key === 'eatery.links' || key === 'dish.links') {
			const { data } = await db
				.from('eatery_dishes')
				.select('eatery_id, dish_id, is_signature, is_best_for, note')
				.eq(type === 'eatery' ? 'eatery_id' : 'dish_id', id)
				.order('created_at');
			rows[r.key] = data ?? [];
		}
	}
	return rows;
}

const thumb = (path: string) => `${SUPABASE_URL}/storage/v1/object/public/photos/${path}-480.webp`;

function shapePhotos(list: Row[]): Photo[] {
	return list
		.map((p) => ({
			id: p.id as string,
			slot: (p.slot as string) ?? null,
			sort_order: (p.sort_order as number) ?? 0,
			file_name: (p.file_name as string) ?? null,
			width: (p.width as number) ?? null,
			height: (p.height as number) ?? null,
			credit: (p.credit as string) ?? null,
			licence: (p.licence as string) ?? null,
			source_url: (p.source_url as string) ?? null,
			thumb: thumb(p.storage_path as string)
		}))
		.sort((a, b) => a.sort_order - b.sort_order);
}

const counts = (photos: { slot: string | null }[]) =>
	photos.reduce<Record<string, number>>((m, p) => {
		if (p.slot) m[p.slot] = (m[p.slot] ?? 0) + 1;
		return m;
	}, {});

function shape(
	type: EntryType,
	row: Row,
	values: Values,
	rows: Rows,
	photos: Photo[],
	team: Row
): Entry {
	const missing = missingRequired(type, values, counts(photos), rows);
	return {
		type,
		id: row.id as string,
		version: (row.updated_at as string) ?? null,
		status: row.status as Status,
		archived_at: (row.archived_at as string) ?? null,
		last_edited_by: (team.last_edited_by as string) ?? null,
		last_edited_at: (row.last_edited_at as string) ?? null,
		owner_id: (row.owner_id as string) ?? null,
		name: (values['tr.en.name'] as string) ?? (row.slug as string),
		code: (row.code as string) ?? null,
		taluka_id: (row.taluka_id as string) ?? null,
		values,
		rows,
		photos,
		missing,
		percent: completeness(type, values, missing)
	};
}

export async function getEntry(type: EntryType, id: string, db: DB = svc()): Promise<Entry | null> {
	const { data: row } = await db
		.from(TABLE[type])
		.select(`*, ${TR_TABLE[type]}(*)`)
		.eq('id', id)
		.maybeSingle();
	if (!row) return null;
	const [{ data: form }, { data: priv }, { data: photos }, { data: teamRow }] = await Promise.all([
		db
			.from('listing_form')
			.select('data')
			.eq('entity_type', type)
			.eq('entity_id', id)
			.maybeSingle(),
		db
			.from('listing_private')
			.select('*')
			.eq('entity_type', type)
			.eq('entity_id', id)
			.maybeSingle(),
		db.from('photos').select('*').eq('entity_type', type).eq('entity_id', id),
		db.from('listing_team').select('*').eq('entity_type', type).eq('entity_id', id).maybeSingle()
	]);
	const formData = (form?.data as Row) ?? {};
	const values = toValues(
		type,
		row,
		(row[TR_TABLE[type]] as Row[]) ?? [],
		formData,
		priv ?? {},
		teamRow ?? {}
	);
	const rows = await loadRows(db, type, id, formData);
	return shape(type, row, values, rows, shapePhotos(photos ?? []), teamRow ?? {});
}

// ---------------------------------------------------------------- list
export type ListItem = Pick<
	Entry,
	| 'type'
	| 'id'
	| 'name'
	| 'code'
	| 'status'
	| 'archived_at'
	| 'last_edited_by'
	| 'last_edited_at'
	| 'taluka_id'
	| 'percent'
> & { category: string | null; missing: number };

/** Every entry of a type with its completeness (forms' required fields), for the list and its filters. */
export async function listEntries(type: EntryType, db: DB = svc()): Promise<ListItem[]> {
	const [
		{ data: main },
		{ data: forms },
		{ data: privs },
		{ data: photos },
		links,
		{ data: teams }
	] = await Promise.all([
		db.from(TABLE[type]).select(`*, ${TR_TABLE[type]}(*)`).limit(5000),
		db.from('listing_form').select('entity_id, data').eq('entity_type', type).limit(5000),
		db.from('listing_private').select('*').eq('entity_type', type).limit(5000),
		db.from('photos').select('entity_id, slot').eq('entity_type', type).limit(20000),
		type === 'dish'
			? db.from('eatery_dishes').select('dish_id').limit(20000)
			: Promise.resolve({ data: [] as Row[] }),
		db.from('listing_team').select('*').eq('entity_type', type).limit(5000)
	]);
	const formBy = new Map((forms ?? []).map((f) => [f.entity_id as string, f.data as Row]));
	const privBy = new Map((privs ?? []).map((p) => [p.entity_id as string, p as Row]));
	const teamBy = new Map((teams ?? []).map((t) => [t.entity_id as string, t as Row]));
	const photosBy = new Map<string, { slot: string | null }[]>();
	for (const p of photos ?? [])
		(photosBy.get(p.entity_id) ?? photosBy.set(p.entity_id, []).get(p.entity_id)!).push(p);
	const linkCount = new Map<string, number>();
	for (const l of links.data ?? [])
		linkCount.set(l.dish_id as string, (linkCount.get(l.dish_id as string) ?? 0) + 1);

	return (main ?? []).map((row: Row) => {
		const id = row.id as string;
		const form = formBy.get(id) ?? {};
		const values = toValues(
			type,
			row,
			(row[TR_TABLE[type]] as Row[]) ?? [],
			form,
			privBy.get(id) ?? {},
			teamBy.get(id) ?? {}
		);
		const rows: Rows = {};
		for (const r of DEFS[type].repeats)
			if (r.min)
				rows[r.key] =
					r.store === 'form'
						? ((form[r.key] as Row[]) ?? [])
						: Array.from({ length: linkCount.get(id) ?? 0 }, () => ({}));
		const missing = missingRequired(type, values, counts(photosBy.get(id) ?? []), rows);
		return {
			type,
			id,
			name: (values['tr.en.name'] as string) ?? (row.slug as string),
			code: (row.code as string) ?? null,
			status: row.status as Status,
			archived_at: (row.archived_at as string) ?? null,
			last_edited_by: (teamBy.get(id)?.last_edited_by as string) ?? null,
			last_edited_at: (row.last_edited_at as string) ?? null,
			taluka_id: (row.taluka_id as string) ?? null,
			category:
				(row.category as string) ?? (form.type as string) ?? (form.category as string) ?? null,
			missing: missing.length,
			percent: completeness(type, values, missing)
		};
	});
}

// ---------------------------------------------------------------- options for pickers
export async function options(db: DB = svc()) {
	const [{ data: talukas }, { data: tides }] = await Promise.all([
		db.from('talukas').select('id, name_en, regions(code_prefix)').order('name_en'),
		db.from('tide_stations').select('id, name').order('name')
	]);
	return {
		talukas: (talukas ?? []).map((t: Row) => ({
			id: t.id as string,
			name: t.name_en as string,
			prefix: ((t.regions as Row | null)?.code_prefix as string) ?? null
		})),
		tides: (tides ?? []) as { id: string; name: string }[]
	};
}

/** Searchable picker: dishes or eateries by name, code or slug. */
export async function search(kind: 'dish' | 'eatery', q: string, db: DB = svc()) {
	const t = kind === 'dish' ? 'dishes' : 'eateries';
	const tr = kind === 'dish' ? 'dish_translations' : 'eatery_translations';
	const { data } = await db
		.from(t)
		.select(`id, slug, code, status, archived_at, ${tr}(lang, name)`)
		.limit(2000);
	const needle = q.trim().toLowerCase();
	return (data ?? [])
		.map((r: Row) => ({
			id: r.id as string,
			name:
				(((r[tr] as Row[]) ?? []).find((x) => x.lang === 'en')?.name as string) ??
				(r.slug as string),
			code: (r.code as string) ?? null,
			archived: !!r.archived_at,
			status: r.status as string
		}))
		.filter(
			(r) =>
				!needle ||
				r.name.toLowerCase().includes(needle) ||
				(r.code ?? '').toLowerCase().includes(needle)
		)
		.sort((a, b) => a.name.localeCompare(b.name))
		.slice(0, 30);
}

/** Linked dishes / eateries that no longer exist or are archived: shown as warnings next to the rows. */
export async function brokenLinks(
	type: EntryType,
	rows: Rows,
	db: DB = svc()
): Promise<{ id: string; problem: 'missing' | 'archived' }[]> {
	if (type !== 'eatery' && type !== 'dish') return [];
	const ids = new Set<string>();
	const col = type === 'eatery' ? 'dish_id' : 'eatery_id';
	for (const r of rows.links ?? []) if (typeof r[col] === 'string') ids.add(r[col] as string);
	if (type === 'eatery')
		for (const r of rows.menu_items ?? []) if (typeof r.dish_id === 'string') ids.add(r.dish_id);
	if (!ids.size) return [];
	const t = type === 'eatery' ? 'dishes' : 'eateries';
	const { data } = await db
		.from(t)
		.select('id, archived_at, status')
		.in('id', [...ids]);
	const found = new Map((data ?? []).map((r: Row) => [r.id as string, r]));
	return [...ids].flatMap((id): { id: string; problem: 'missing' | 'archived' }[] => {
		const r = found.get(id);
		if (!r) return [{ id, problem: 'missing' }];
		return r.archived_at ? [{ id, problem: 'archived' }] : [];
	});
}

// ---------------------------------------------------------------- save (patch + optimistic lock)
export type SaveResult =
	| { ok: true; entry: Entry }
	| { ok: false; conflict: Entry }
	| { ok: false; errors: Record<string, string>; message?: string };

const asMonth = (m: unknown) => (typeof m === 'string' ? MONTHS.indexOf(m as never) + 1 : null);

/** One transaction (admin_apply_save): the version check and every part of the save, or nothing at all. */
async function apply(
	db: DB,
	type: EntryType,
	id: string,
	version: string | null,
	plan: Row
): Promise<SaveResult> {
	const { error: e } = await db.rpc('admin_apply_save', {
		_type: type,
		_id: id,
		_version: version,
		_plan: plan
	});
	if (e?.code === '40001') {
		const theirs = await getEntry(type, id, db);
		return theirs ? { ok: false, conflict: theirs } : error(404, 'entry not found');
	}
	if (e) return { ok: false, errors: {}, message: dbMessage(e) };
	return { ok: true, entry: (await getEntry(type, id, db))! };
}

function dbMessage(e: { message?: string; code?: string } | null) {
	const m = e?.message ?? 'save failed';
	if (/pin_to_publish/.test(m)) return 'A GPS pin is needed before approval.';
	if (/English text needed/.test(m))
		return 'An English “What makes it special” story is needed to approve a desk place.';
	if (/duplicate key.*code/.test(m)) return 'Another entry already uses this ID.';
	if (/duplicate key.*slug/.test(m)) return 'Another entry already uses this web address (slug).';
	if (/desk_sources/.test(m)) return 'A desk entry needs 1–10 source links.';
	if (/eatery_dishes.*unique|duplicate key.*eatery_dishes/.test(m))
		return 'The same dish ↔ eatery link is listed twice.';
	return m;
}

export async function saveEntry(
	type: EntryType,
	id: string,
	input: { version: string | null; changes: Values; rows: Rows },
	editor: string,
	db: DB = svc()
): Promise<SaveResult> {
	const cur = await getEntry(type, id, db);
	if (!cur) error(404, 'entry not found');
	if (cur.version !== input.version) return { ok: false, conflict: cur };

	const fields = new Map(allFields(type).map((f) => [f.key, f] as const));
	const changes: Values = {};
	for (const [k, v] of Object.entries(input.changes ?? {})) {
		const f = fields.get(k);
		if (!f) error(400, `unknown field ${k}`);
		changes[k] = f.kind === 'gps' ? (v ?? null) : normalize(f.kind, v);
	}
	const rowKeys = Object.keys(input.rows ?? {});
	for (const k of rowKeys)
		if (!DEFS[type].repeats.some((r) => r.key === k)) error(400, `unknown rows ${k}`);
	const rowsIn: Rows = {};
	for (const k of rowKeys)
		rowsIn[k] = (input.rows[k] ?? []).map((row) =>
			Object.fromEntries(
				Object.entries(row).map(([c, val]) => [
					c,
					typeof val === 'string' ? normalize('text', val) : val
				])
			)
		);

	// Form rules: verified_by / visit date from the admin and today when still empty; next check from the visit date.
	const merged = { ...cur.values, ...changes };
	if (isEmpty(merged['team.verified_by']))
		changes['team.verified_by'] = merged['team.verified_by'] = editor;
	if (isEmpty(merged.last_verified_at))
		changes.last_verified_at = merged.last_verified_at = todayIst();
	const months = DEFS[type].recheckMonths;
	if (
		months &&
		'last_verified_at' in changes &&
		!('next_recheck_at' in input.changes) &&
		typeof merged.last_verified_at === 'string'
	)
		changes.next_recheck_at = merged.next_recheck_at = recheckFrom(merged.last_verified_at, months);

	const region = (await options(db)).talukas.find((t) => t.id === merged.taluka_id)?.prefix ?? null;
	const errors = {
		...validate({ type, regionPrefix: region }, merged, Object.keys(changes)),
		...validateRows(type, rowsIn, rowKeys)
	};
	if (type === 'eatery' && rowsIn.links) {
		const ids = rowsIn.links.map((r) => r.dish_id);
		if (new Set(ids).size !== ids.length) errors.links = 'The same dish is listed twice';
	}
	if (type === 'dish' && rowsIn.links) {
		const ids = rowsIn.links.map((r) => r.eatery_id);
		if (new Set(ids).size !== ids.length) errors.links = 'The same eatery is listed twice';
	}
	if (Object.keys(errors).length) return { ok: false, errors };

	// Everything below goes into one plan, applied in one transaction (admin_apply_save): all or nothing.
	const { data: rowNow } = await db.from(TABLE[type]).select('*').eq('id', id).single();
	const row: Row = { last_edited_at: new Date().toISOString() };
	for (const [k, v] of Object.entries(changes)) {
		if (/^(tr|form|private|team)\./.test(k)) continue;
		if (k === 'gps') {
			const g = v as { lat: number; lng: number } | null;
			row.location = g ? `SRID=4326;POINT(${g.lng} ${g.lat})` : null;
		} else if (k === 'menu.items') {
			row.menu = { ...((row.menu ?? rowNow?.menu ?? {}) as Row), items: v ?? [] };
		} else if (k.includes('.')) {
			const [col, ...path] = k.split('.');
			const obj = structuredClone((row[col!] ?? rowNow?.[col!] ?? {}) as Row);
			if (path.length === 1) {
				if (v === null) delete obj[path[0]!];
				else obj[path[0]!] = v;
			} else {
				const inner = { ...((obj[path[0]!] as Row) ?? {}) };
				if (v === null) delete inner[path[1]!];
				else inner[path[1]!] = v;
				if (Object.keys(inner).length) obj[path[0]!] = inner;
				else delete obj[path[0]!];
			}
			row[col!] = obj;
		} else if (DATE_TS.has(k)) row[k] = dateTs(v);
		else if (k === 'vibe_tags' || k === 'source_urls') row[k] = v ?? [];
		else row[k] = v;
	}
	const plan: Row = {
		row,
		team: {
			verified_by: merged['team.verified_by'] ?? null,
			reviewed_by: merged['team.reviewed_by'] ?? null,
			last_edited_by: editor
		}
	};

	// Translations: one row per language; a language row needs its name.
	const tr: Row[] = [];
	for (const lang of LANGS) {
		if (!Object.keys(changes).some((k) => k.startsWith(`tr.${lang}.`))) continue;
		const values: Row = {};
		for (const f of TR_FIELDS[type]) values[f] = merged[`tr.${lang}.${f}`] ?? null;
		if (lang !== 'en' && TR_FIELDS[type].every((f) => isEmpty(values[f]))) {
			tr.push({ lang, delete: true });
			continue;
		}
		if (isEmpty(values.name))
			return {
				ok: false,
				errors: { [`tr.${lang}.name`]: 'Needed to save text in this language' },
				message: `Name in ${lang === 'en' ? 'English' : lang === 'mr' ? 'Marathi' : 'Hindi'} is needed to save that language's text.`
			};
		tr.push({ lang, values });
	}
	if (tr.length) plan.tr = tr;

	// Field-form answers and form-kept rows (staff-only table): the whole object.
	const formKeys = Object.keys(changes).filter((k) => k.startsWith('form.'));
	const formRows = DEFS[type].repeats.filter((r) => r.store === 'form' && rowKeys.includes(r.key));
	if (formKeys.length || formRows.length) {
		const { data: f } = await db
			.from('listing_form')
			.select('data')
			.eq('entity_type', type)
			.eq('entity_id', id)
			.maybeSingle();
		const data = { ...((f?.data as Row) ?? {}) };
		for (const k of formKeys) {
			if (changes[k] === null) delete data[k.slice(5)];
			else data[k.slice(5)] = changes[k];
		}
		for (const r of formRows) data[r.key] = rowsIn[r.key];
		plan.form = data;
	}

	// Private fields (staff-only table).
	if (Object.keys(changes).some((k) => k.startsWith('private.')))
		plan.private = {
			owner_phone: merged['private.owner_phone'] ?? null,
			internal_notes: merged['private.internal_notes'] ?? null,
			source_notes: merged['private.source_notes'] ?? null
		};

	// Child-table rows: the new set replaces the old one.
	plan.children = childPlan(type, id, rowsIn, rowKeys);
	return apply(db, type, id, cur.version, plan);
}

/** Child-table replacements for admin_apply_save (whitelisted there too). */
export function childPlan(type: EntryType, id: string, rowsIn: Rows, rowKeys: string[]) {
	const children: Row[] = [];
	for (const r of DEFS[type].repeats.filter(
		(x) => x.store === 'table' && rowKeys.includes(x.key)
	)) {
		const list = rowsIn[r.key] ?? [];
		const key = `${type}.${r.key}`;
		if (key === 'place.hours' || key === 'eatery.hours')
			children.push({
				table: type === 'place' ? 'place_hours' : 'eatery_hours',
				key: FK[type],
				rows: list.map((h) => ({
					[FK[type]]: id,
					weekday: h.weekday,
					opens: h.opens ? `${h.opens}:00` : null,
					closes: h.closes ? `${h.closes}:00` : null,
					hours_unknown: h.hours_unknown === true
				}))
			});
		else if (key === 'place.seasonal')
			children.push({
				table: 'place_seasonal',
				key: 'place_id',
				rows: list.map((s) => ({
					place_id: id,
					season: s.season,
					from_month: asMonth(s.from_month),
					to_month: asMonth(s.to_month)
				}))
			});
		else if (key === 'place.crowd')
			children.push({
				table: 'crowd_typical',
				key: 'place_id',
				rows: list.map((c) => ({
					place_id: id,
					weekday: c.weekday,
					season: c.season ?? null,
					level: c.level
				}))
			});
		else if (key === 'stay.offers')
			children.push({
				table: 'stay_offers',
				key: 'stay_id',
				rows: list.map((o) => ({ stay_id: id, provider: o.provider, deep_link: o.deep_link }))
			});
		else if (key === 'eatery.links' || key === 'dish.links')
			children.push({
				table: 'eatery_dishes',
				key: type === 'eatery' ? 'eatery_id' : 'dish_id',
				rows: list.map((l) => ({
					eatery_id: type === 'eatery' ? id : l.eatery_id,
					dish_id: type === 'dish' ? id : l.dish_id,
					is_signature: l.is_signature === true,
					is_best_for: l.is_best_for === true,
					note: l.note ?? null
				}))
			});
	}
	return children;
}

// ---------------------------------------------------------------- workflow, archive, create, delete
const team = (cur: Entry, editor: string, reviewed?: string) => ({
	verified_by: cur.values['team.verified_by'] ?? null,
	reviewed_by: reviewed ?? cur.values['team.reviewed_by'] ?? null,
	last_edited_by: editor
});

export async function setStatus(
	type: EntryType,
	id: string,
	version: string | null,
	to: Status,
	editor: string,
	db: DB = svc()
): Promise<SaveResult> {
	const cur = await getEntry(type, id, db);
	if (!cur) error(404, 'entry not found');
	if (cur.version !== version) return { ok: false, conflict: cur };
	if (cur.archived_at) return { ok: false, errors: {}, message: 'Restore the entry first.' };
	const row: Row = { status: to, last_edited_at: new Date().toISOString() };
	if (to === 'published') row.reviewed_on = todayIst();
	return apply(db, type, id, version, {
		row,
		team: team(cur, editor, to === 'published' ? editor : undefined)
	});
}

/** Archive: off the public site (status draft), remembered status; restore puts it back. */
export async function setArchived(
	type: EntryType,
	id: string,
	version: string | null,
	archive: boolean,
	editor: string,
	db: DB = svc()
): Promise<SaveResult> {
	const cur = await getEntry(type, id, db);
	if (!cur) error(404, 'entry not found');
	if (cur.version !== version) return { ok: false, conflict: cur };
	const { data: now } = await db
		.from(TABLE[type])
		.select('status, archived_status')
		.eq('id', id)
		.single();
	const stamp = { last_edited_at: new Date().toISOString() };
	const row: Row = archive
		? {
				...stamp,
				archived_at: new Date().toISOString(),
				archived_status: now?.status,
				status: 'draft'
			}
		: {
				...stamp,
				archived_at: null,
				archived_status: null,
				status: now?.archived_status ?? 'draft'
			};
	return apply(db, type, id, version, { row, team: team(cur, editor) });
}

const slugify = (s: string) =>
	s
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^\w\s-]/g, '')
		.trim()
		.replace(/[\s_]+/g, '-')
		.slice(0, 40) || 'entry';

/** New draft with the columns the table can't do without; everything else is Unknown until someone fills it. */
export async function createEntry(
	type: EntryType,
	input: { name_en: string; taluka_id?: string | null; category?: string | null },
	editor: string,
	db: DB = svc()
) {
	const id = crypto.randomUUID();
	const name = input.name_en.trim();
	if (name.length < 2 || name.length > 120) error(400, 'Name in English: 2–120 characters');
	const row: Row = {
		id,
		slug: `${slugify(name)}-${id.slice(0, 4)}`,
		status: 'draft',
		last_edited_at: new Date().toISOString()
	};
	if (type !== 'dish') {
		if (!input.taluka_id) error(400, 'Pick a taluka');
		row.taluka_id = input.taluka_id;
	}
	if (type === 'place') {
		if (!input.category) error(400, 'Pick the type of place');
		row.category = input.category;
		row.verification_method = 'field';
	}
	const { error: e } = await db.from(TABLE[type]).insert(row);
	if (e) error(400, dbMessage(e));
	// Name and team row in one transaction; a failure takes the new row away again.
	const r = await apply(db, type, id, null, {
		row: {},
		team: { verified_by: null, reviewed_by: null, last_edited_by: editor },
		tr: [{ lang: 'en', values: { name } }]
	});
	if (!r.ok) {
		await db.from(TABLE[type]).delete().eq('id', id);
		error(400, 'message' in r && r.message ? r.message : 'could not create the entry');
	}
	return id;
}

/** Delete forever: typed confirmation must match the English name or the ID. Photos (files + rows) and every
 * related row go too (admin_delete_listing). */
export async function deleteForever(type: EntryType, id: string, typed: string, db: DB = svc()) {
	const cur = await getEntry(type, id, db);
	if (!cur) error(404, 'entry not found');
	const t = typed.trim().toLowerCase();
	if (!t || (t !== cur.name.trim().toLowerCase() && t !== (cur.code ?? '').toLowerCase()))
		error(400, 'Type the entry name exactly to confirm');
	const { data: photos } = await db.from('photos').select('storage_path').eq('entity_id', id);
	const { data: reviews } = await db
		.from('reviews')
		.select('review_photos(storage_path)')
		.eq('entity_id', id);
	const { error: e } = await db.rpc('admin_delete_listing', { _type: type, _id: id });
	if (e) error(400, dbMessage(e));
	const files = (photos ?? []).flatMap((p: Row) =>
		[480, 960, 1600].map((w) => `${p.storage_path}-${w}.webp`)
	);
	const reviewFiles = (reviews ?? []).flatMap((r: Row) =>
		((r.review_photos as Row[]) ?? []).flatMap((p) =>
			[480, 960].map((w) => `${p.storage_path}-${w}.webp`)
		)
	);
	if (files.length) await db.storage.from('photos').remove(files);
	if (reviewFiles.length) await db.storage.from('review-photos').remove(reviewFiles);
}

// ---------------------------------------------------------------- photos
/** File names and hero flag follow the slot order (forms' naming: RTN-P-001_hero.jpg, …_room01.jpg). */
export async function renumberPhotos(type: EntryType, id: string, db: DB = svc()) {
	const [{ data: row }, { data: photos }] = await Promise.all([
		db.from(TABLE[type]).select('code').eq('id', id).single(),
		db.from('photos').select('id, slot, sort_order').eq('entity_type', type).eq('entity_id', id)
	]);
	for (const s of DEFS[type].slots) {
		const list = (photos ?? [])
			.filter((p: Row) => p.slot === s.slot)
			.sort((a: Row, b: Row) => (a.sort_order as number) - (b.sort_order as number));
		for (const [i, p] of list.entries())
			await db
				.from('photos')
				.update({
					sort_order: i,
					file_name: photoFileName((row?.code as string) ?? null, s, i),
					is_hero: s.slot === 'hero' || s.slot === 'cover' || (type === 'dish' && i === 0)
				})
				.eq('id', p.id);
	}
}

export async function addPhoto(
	type: EntryType,
	id: string,
	p: {
		photoId: string;
		slot: string;
		width: number;
		height: number;
		lqip: string;
		files: [number, File][];
		credit: { credit: string | null; licence: string | null; source_url: string | null };
		replace?: string | null;
	},
	uploadedBy: string,
	db: DB = svc()
) {
	const slot = DEFS[type].slots.find((s) => s.slot === p.slot);
	if (!slot) error(400, 'unknown photo slot');
	const { data: same } = await db
		.from('photos')
		.select('id, sort_order')
		.eq('entity_id', id)
		.eq('slot', p.slot);
	const replacing = p.replace ? (same ?? []).find((x: Row) => x.id === p.replace) : null;
	if (p.replace && !replacing) error(400, 'photo to replace not found');
	if (!replacing && (same?.length ?? 0) >= slot.max)
		error(400, `${slot.label}: at most ${slot.max}`);
	const path = `${type}/${id}/${p.photoId}`;
	const storage = db.storage.from('photos');
	for (const [w, f] of p.files) {
		const { error: up } = await storage.upload(`${path}-${w}.webp`, f, {
			contentType: 'image/webp',
			upsert: true
		});
		if (up) error(502, `upload failed: ${up.message}`);
	}
	const order = replacing
		? (replacing.sort_order as number)
		: Math.max(-1, ...(same ?? []).map((x: Row) => x.sort_order as number)) + 1;
	const { error: e } = await db.from('photos').insert({
		id: p.photoId,
		entity_type: type,
		entity_id: id,
		storage_path: path,
		lqip: p.lqip,
		width: p.width,
		height: p.height,
		uploaded_by: uploadedBy,
		slot: p.slot,
		sort_order: order,
		...p.credit
	});
	if (e) error(400, dbMessage(e));
	if (replacing) await removePhoto(type, id, replacing.id as string, db, false);
	await renumberPhotos(type, id, db);
}

export async function removePhoto(
	type: EntryType,
	id: string,
	photoId: string,
	db: DB = svc(),
	renumber = true
) {
	const { data: p } = await db
		.from('photos')
		.select('storage_path')
		.eq('id', photoId)
		.eq('entity_id', id)
		.maybeSingle();
	if (!p) error(404, 'photo not found');
	const { error: e } = await db.from('photos').delete().eq('id', photoId);
	if (e) error(400, dbMessage(e));
	await db.storage
		.from('photos')
		.remove([480, 960, 1600].map((w) => `${p.storage_path}-${w}.webp`));
	if (renumber) await renumberPhotos(type, id, db);
}

/** New order (and slot) for an entry's photos: [{id, slot}] in display order. */
export async function arrangePhotos(
	type: EntryType,
	id: string,
	order: { id: string; slot: string }[],
	db: DB = svc()
) {
	const slots = new Set(DEFS[type].slots.map((s) => s.slot));
	for (const [i, o] of order.entries()) {
		if (!slots.has(o.slot)) error(400, 'unknown photo slot');
		await db
			.from('photos')
			.update({ slot: o.slot, sort_order: i })
			.eq('id', o.id)
			.eq('entity_id', id);
	}
	await renumberPhotos(type, id, db);
}

export async function setPhotoCredit(
	id: string,
	photoId: string,
	c: { credit: string | null; licence: string | null; source_url: string | null },
	db: DB = svc()
) {
	const { error: e } = await db.from('photos').update(c).eq('id', photoId).eq('entity_id', id);
	if (e) error(400, dbMessage(e));
}

// ---------------------------------------------------------------- reviews (hide only; votes and verdicts untouched)
export async function reviewsFor(type: EntryType, id: string, db: DB = svc()) {
	if (type === 'dish') return [];
	const { data } = await db
		.from('reviews')
		.select('id, text, moderation_status, created_at, review_photos(id, storage_path, hidden_at)')
		.eq('entity_type', type)
		.eq('entity_id', id)
		.order('created_at', { ascending: false })
		.limit(200);
	return (data ?? []).map((r: Row) => ({
		id: r.id as string,
		text: (r.text as string) ?? null,
		status: r.moderation_status as string,
		created_at: r.created_at as string,
		photos: ((r.review_photos as Row[]) ?? []).map((p) => ({
			id: p.id as string,
			hidden: !!p.hidden_at,
			thumb: `${SUPABASE_URL}/storage/v1/object/public/review-photos/${p.storage_path}-480.webp`
		}))
	}));
}

export async function moderate(
	kind: 'review' | 'photo',
	targetId: string,
	hide: boolean,
	db: DB = svc()
) {
	const { error: e } =
		kind === 'review'
			? await db
					.from('reviews')
					.update({ moderation_status: hide ? 'rejected' : 'approved' })
					.eq('id', targetId)
			: await db
					.from('review_photos')
					.update({ hidden_at: hide ? new Date().toISOString() : null })
					.eq('id', targetId);
	if (e) error(400, dbMessage(e));
}

export type { Field };
