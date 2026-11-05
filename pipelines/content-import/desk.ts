// Desk data importer for data/ (YAML from DATA_REQUIREMENTS §4.4; user approval 2026-11-05: S1–S3, C1–C4, P1, D1).
// Places, stays and eateries land unpublished (in_review, desk; low-trust rows and places with no English text as draft),
// dishes as a bare slug with all their text in content_drafts, events as draft, seasons as rows of their place.
// Every long text and every HI name goes to content_drafts for a reviewer; `_sources` / `_review` / source keys
// with no column go to import_audit. Never written: is_verified, is_hidden_gem, last_verified_at, amenities,
// network strength, phones and 24 h status of hospitals and police (C2, Q13), itineraries (P7-15).
// Re-runs change only what changed in the YAML (C4): a published listing is never touched, nor a draft a reviewer
// approved, rejected or edited (import_audit keeps a hash of the text last imported).
// Local stack only (M23). --dry-run runs every write inside a transaction that is rolled back.
// Usage: node content-import/desk.ts <data dir> (--dry-run | --apply) [--photos --photo-owner <admin email>]
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type pg from 'pg';
import { parse } from 'yaml';
import { DATA, db } from '../lib/common.ts';
import {
	LANGS, PLACE_TEXT, dishSchema, eaterySchema, eventSchema, flagOf, hoursOf, osmKey, photoSchema, placeSchema,
	reason, seasonalSchema, softChecks, sourceUrls, staySchema, utilitySchema
} from './desk-schema.ts';
import { importPhotos, photoSizes, type Photo } from './photos.ts';

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--photo-owner'));
const dry = args.includes('--dry-run');
const apply = args.includes('--apply');
const owner = args[args.indexOf('--photo-owner') + 1];
if (!dir || dry === apply) {
	console.error('usage: node content-import/desk.ts <data dir> (--dry-run | --apply) [--photos --photo-owner <email>]');
	process.exit(1);
}
if (args.includes('--live')) {
	console.error('local stack only: the hosted project is not an import target yet (M23)');
	process.exit(1);
}
if (apply && args.includes('--photos') && !args.includes('--photo-owner')) {
	console.error('--photos needs --photo-owner <admin email>');
	process.exit(1);
}

type Row = Record<string, unknown>;
const load = (f: string) => (parse(readFileSync(join(dir, f), 'utf8')) ?? []) as Row[];
const yamls = (sub: string) =>
	readdirSync(join(dir, sub))
		.filter((f) => f.endsWith('.yaml'))
		.sort()
		.flatMap((f) => load(`${sub}/${f}`).map((r) => ({ f: `${sub}/${f}`, r })));

// ---------------------------------------------------------------- report
type State = 'insert' | 'update' | 'unchanged' | 'skip' | 'reject';
const counts = new Map<string, Record<State, number>>();
const bump = (entity: string, s: State) => {
	const c = counts.get(entity) ?? { insert: 0, update: 0, unchanged: 0, skip: 0, reject: 0 };
	c[s]++;
	counts.set(entity, c);
};
const failures: string[] = [];
const warnings: string[] = [];
const notes: string[] = [];
const fail = (entity: string, tag: string, why: string) => {
	bump(entity, 'reject');
	failures.push(`${entity} ${tag}: ${why}`);
};

// ---------------------------------------------------------------- generic writes
const canon = (v: unknown) =>
	JSON.stringify(v ?? null, (_k, x) =>
		x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x
	);
const same = (a: unknown, b: unknown) => canon(a) === canon(b);
const sha = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 16);
const compact = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null));
type Point = [number, number] | null | undefined; // undefined: the table has no location

/** Insert, or update only the changed columns. A published row is left alone (C4). */
async function upsert(
	c: pg.Client, entity: string, table: string, key: Row, values: Row, point: Point, onInsert: Row = {}
): Promise<{ id: string; state: State }> {
	const kv = Object.entries(key);
	const cur = (
		await c.query(
			`select id, to_jsonb(t) ->> 'status' as status, to_jsonb(t) - 'location' as j,
			   ${point === undefined ? 'null' : 'extensions.st_astext(location)'} as wkt
			 from public.${table} t where ${kv.map(([k], i) => `${k} is not distinct from $${i + 1}`).join(' and ')}`,
			kv.map(([, v]) => v)
		)
	).rows[0] as { id: string; status: string | null; j: Row; wkt: string | null } | undefined;
	const ewkt = point ? `SRID=4326;POINT(${point[0]} ${point[1]})` : null;
	if (!cur) {
		const cols = Object.entries({ ...key, ...values, ...onInsert });
		const names = cols.map(([k]) => k);
		const params = cols.map(([, v]) => v);
		const ph = params.map((_, i) => `$${i + 1}`);
		if (point !== undefined) {
			names.push('location');
			params.push(ewkt);
			ph.push(`$${params.length}::extensions.geography`);
		}
		const id = (
			await c.query(`insert into public.${table} (${names.join(', ')}) values (${ph.join(', ')}) returning id`, params)
		).rows[0].id as string;
		bump(entity, 'insert');
		return { id, state: 'insert' };
	}
	if (cur.status === 'published') {
		bump(entity, 'skip');
		return { id: cur.id, state: 'skip' };
	}
	const changed = Object.entries(values).filter(([k, v]) => !same(cur.j[k], v));
	const sets = changed.map(([k], i) => `${k} = $${i + 2}`);
	const params: unknown[] = [cur.id, ...changed.map(([, v]) => v)];
	// A missing pin in the YAML never erases one added later (null stays null; nothing is removed).
	if (point && cur.wkt !== `POINT(${point[0]} ${point[1]})`) {
		params.push(ewkt);
		sets.push(`location = $${params.length}::extensions.geography`);
	}
	if (!sets.length) {
		bump(entity, 'unchanged');
		return { id: cur.id, state: 'unchanged' };
	}
	await c.query(`update public.${table} set ${sets.join(', ')} where id = $1`, params);
	bump(entity, 'update');
	return { id: cur.id, state: 'update' };
}

/** Name-only translation rows (EN + MR names, as the CSV importer and the spec do: M7). */
async function names(c: pg.Client, table: string, fk: string, id: string, byLang: Record<string, string | null>) {
	for (const [lang, name] of Object.entries(byLang)) {
		if (!name) continue;
		const cur = (await c.query(`select name from public.${table} where ${fk} = $1 and lang = $2`, [id, lang])).rows[0];
		if (!cur) {
			await c.query(`insert into public.${table} (${fk}, lang, name) values ($1, $2, $3)`, [id, lang, name]);
			bump(table, 'insert');
		} else if (cur.name !== name) {
			await c.query(`update public.${table} set name = $3 where ${fk} = $1 and lang = $2`, [id, lang, name]);
			bump(table, 'update');
		} else bump(table, 'unchanged');
	}
}

/** Weekday hours from one opens/closes pair + closed days (M6: imported as given, never split). */
async function hours(c: pg.Client, table: string, fk: string, id: string, rows: ReturnType<typeof hoursOf>) {
	if (!rows.length) return;
	const cur = (
		await c.query(
			`select weekday, to_char(opens, 'HH24:MI') as opens, to_char(closes, 'HH24:MI') as closes
			 from public.${table} where ${fk} = $1 order by weekday`,
			[id]
		)
	).rows;
	if (same(cur, rows)) return bump(table, 'unchanged');
	await c.query(`delete from public.${table} where ${fk} = $1`, [id]);
	for (const h of rows)
		await c.query(`insert into public.${table} (${fk}, weekday, opens, closes) values ($1, $2, $3, $4)`, [
			id, h.weekday, h.opens, h.closes
		]);
	bump(table, cur.length ? 'update' : 'insert');
}

/**
 * Text for a reviewer (content_drafts). `before` = hashes of the text this importer last wrote; a draft whose text
 * no longer matches it was edited by a reviewer and is kept. Approved or rejected drafts are never touched.
 */
async function drafts(c: pg.Client, type: string, id: string, want: Record<string, string>, before: Record<string, string>) {
	const rows = (
		await c.query(
			`select id, lang, field, draft_text, status from public.content_drafts where entity_type = $1 and entity_id = $2`,
			[type, id]
		)
	).rows as { id: string; lang: string; field: string; draft_text: string; status: string }[];
	const snap = { ...before };
	for (const [k, t] of Object.entries(want)) {
		const [lang, field] = k.split('.');
		const mine = rows.filter((r) => r.lang === lang && r.field === field);
		const d = mine.find((r) => r.status === 'draft');
		if (mine.some((r) => r.status !== 'draft') || (!d && before[k]) || (d && d.draft_text !== t && before[k] !== sha(d.draft_text))) {
			bump('content_drafts', 'skip');
			continue;
		}
		snap[k] = sha(t);
		if (!d) {
			await c.query(
				`insert into public.content_drafts (entity_type, entity_id, lang, field, draft_text) values ($1, $2, $3, $4, $5)`,
				[type, id, lang, field, t]
			);
			bump('content_drafts', 'insert');
		} else if (d.draft_text !== t) {
			await c.query(`update public.content_drafts set draft_text = $2, updated_at = now() where id = $1`, [d.id, t]);
			bump('content_drafts', 'update');
		} else bump('content_drafts', 'unchanged');
	}
	return snap;
}

async function priorDrafts(c: pg.Client, type: string, key: string) {
	const r = (
		await c.query(`select meta -> '_drafts' as d from public.import_audit where entity_type = $1 and entity_key = $2`, [type, key])
	).rows[0];
	return (r?.d ?? {}) as Record<string, string>;
}

async function audit(c: pg.Client, type: string, key: string, file: string, meta: Row, needs: string[]): Promise<State> {
	const why = needs.length ? needs.join('; ') : null;
	const cur = (
		await c.query(
			`select source_file, meta, needs_review, review_reason from public.import_audit where entity_type = $1 and entity_key = $2`,
			[type, key]
		)
	).rows[0];
	const m = compact(meta);
	if (!cur) {
		await c.query(
			`insert into public.import_audit (entity_type, entity_key, source_file, meta, needs_review, review_reason)
			 values ($1, $2, $3, $4, $5, $6)`,
			[type, key, file, m, !!why, why]
		);
		bump('import_audit', 'insert');
		return 'insert';
	}
	if (cur.source_file === file && same(cur.meta, m) && cur.needs_review === !!why && cur.review_reason === why) {
		bump('import_audit', 'unchanged');
		return 'unchanged';
	}
	await c.query(
		`update public.import_audit set source_file = $3, meta = $4, needs_review = $5, review_reason = $6
		 where entity_type = $1 and entity_key = $2`,
		[type, key, file, m, !!why, why]
	);
	bump('import_audit', 'update');
	return 'update';
}

/** One row in its own savepoint: a database error rejects that row only. */
async function guarded(c: pg.Client, entity: string, tag: string, fn: () => Promise<void>) {
	await c.query('savepoint row');
	try {
		await fn();
		await c.query('release savepoint row');
	} catch (e) {
		await c.query('rollback to savepoint row');
		fail(entity, tag, (e as Error).message);
	}
}

// ---------------------------------------------------------------- run
const client = await db();
const placeIds = new Map<string, { id: string; published: boolean }>();
const held: string[] = [];
const utilityLines: string[] = [];
let photos: Photo[] = [];
try {
	const categories = (
		await client.query<{ c: string }>(`select unnest(enum_range(null::public.place_category))::text as c`)
	).rows.map((r) => r.c);
	const talukas = new Map(
		(await client.query<{ id: string; name_en: string }>(`select id, name_en from public.talukas`)).rows.map((t) => [
			t.name_en.toLowerCase(),
			t.id
		])
	);
	const ctx = { categories, talukas };
	await client.query('begin');

	// Dishes first: eatery dish links point at them.
	const dishRows = load('dishes/dishes.yaml');
	const dishIds = new Map<string, string>();
	for (const r of dishRows) {
		const tag = String(r.slug);
		const p = dishSchema.safeParse(r);
		if (!p.success) {
			fail('dishes', tag, reason(p.error));
			continue;
		}
		const x = p.data;
		await guarded(client, 'dishes', tag, async () => {
			const cur = (
				await client.query(`select d.id, exists (select 1 from public.dish_translations t where t.dish_id = d.id) as live
				   from public.dishes d where d.slug = $1`, [x.slug])
			).rows[0];
			// A dish is live once a reviewer approved its text (it has translations): never touched then (C4).
			if (cur?.live) {
				dishIds.set(x.slug, cur.id);
				return bump('dishes', 'skip');
			}
			const { id } = await upsert(client, 'dishes', 'dishes', { slug: x.slug }, {}, undefined);
			dishIds.set(x.slug, id);
			const want: Record<string, string> = {};
			for (const l of LANGS) {
				if (x.name[l]) want[`${l}.name`] = x.name[l]!;
				if (x.what_it_is[l]) want[`${l}.what_it_is`] = x.what_it_is[l] as string;
				if (x.story[l]) want[`${l}.story`] = x.story[l] as string;
			}
			const snap = await drafts(client, 'dish', id, want, await priorDrafts(client, 'dish', x.slug));
			const soft = softChecks({
				mr: [x.name.mr, x.what_it_is.mr as string, x.story.mr as string],
				hi: [x.name.hi, x.what_it_is.hi as string, x.story.hi as string],
				long: LANGS.flatMap((l) => [x.story[l] as string])
			});
			soft.forEach((w) => warnings.push(`dish ${x.slug}: ${w}`));
			await audit(client, 'dish', x.slug, 'dishes/dishes.yaml', { _sources: x._sources, _review: x._review, _drafts: snap }, soft);
		});
	}

	// Places.
	const pschema = placeSchema(ctx);
	const seen = new Set<string>();
	const inline: string[] = [];
	for (const { f, r } of yamls('places')) {
		const tag = `${f} :: ${r.slug}`;
		const p = pschema.safeParse(r);
		if (!p.success) {
			fail('places', tag, reason(p.error));
			continue;
		}
		const x = p.data;
		if (seen.has(x.slug)) {
			fail('places', tag, 'slug repeated');
			continue;
		}
		seen.add(x.slug);
		for (const s of x.seasons as { season: string; from_month: number; to_month: number }[])
			inline.push(`${x.slug}|${s.season}|${s.from_month}|${s.to_month}`);
		if (x.lat != null) {
			const at = (await client.query('select public.taluka_at($1, $2) as id', [x.lng, x.lat])).rows[0].id;
			if (at && at !== x.taluka) {
				fail('places', tag, 'the pin is outside that taluka');
				continue;
			}
		}
		const flag = flagOf(x._review);
		const noEn = !Object.values(x.text.en).some(Boolean);
		const soft = softChecks({
			mr: [x.name_mr, ...(Object.values(x.text.mr) as (string | null)[])],
			hi: [x.name_hi, ...(Object.values(x.text.hi) as (string | null)[])],
			long: LANGS.flatMap((l) => Object.values(x.text[l]) as (string | null)[])
		});
		soft.forEach((w) => warnings.push(`place ${x.slug}: ${w}`));
		const needs = [flag, noEn ? 'no English text: keep out of publish' : null, ...soft].filter((s): s is string => !!s);
		const draft = !!flag || noEn;
		await guarded(client, 'places', tag, async () => {
			const { id, state } = await upsert(
				client, 'places', 'places', { slug: x.slug },
				{
					category: x.category, taluka_id: x.taluka, entry_fee_text: x.entry_fee_text, entry_fee_inr: x.entry_fee_inr,
					visit_minutes: x.visit_minutes, best_time_text: x.best_time, how_to_reach_text: x.how_to_reach,
					nearest_station_text: x.nearest_station, nearest_bus_stop_text: x.nearest_bus_stop,
					monsoon_status: x.monsoon_status, monsoon_reason: x.monsoon_reason, is_tide_dependent: x.is_tide_dependent,
					source_urls: sourceUrls(x._sources)
				},
				x.lat == null ? null : [x.lng!, x.lat],
				{ status: draft ? 'draft' : 'in_review', verification_method: 'desk' }
			);
			placeIds.set(x.slug, { id, published: state === 'skip' });
			if (state === 'skip') return;
			if (needs.length) held.push(`${x.slug} [${draft ? 'draft' : 'in_review'}${x.lat == null ? ', no pin' : ''}]: ${needs.join('; ')}`);
			await names(client, 'place_translations', 'place_id', id, { en: x.name_en, mr: x.name_mr });
			await hours(client, 'place_hours', 'place_id', id, hoursOf(x));
			const want: Record<string, string> = {};
			for (const l of LANGS)
				for (const k of PLACE_TEXT) if (x.text[l][k]) want[`${l}.${k}`] = x.text[l][k] as string;
			if (x.name_hi) want['hi.name'] = x.name_hi;
			const snap = await drafts(client, 'place', id, want, await priorDrafts(client, 'place', x.slug));
			await audit(client, 'place', x.slug, f, {
				_sources: x._sources, _review: x._review, _collected_by: x._collected_by, coord_source: x.coord_source,
				osm_id: x.osm_id, wikipedia_url: x.wikipedia_url, _drafts: snap
			}, needs);
		});
	}

	// Eateries (no pins yet: S1).
	const eschema = eaterySchema(ctx, new Set(dishRows.map((d) => String(d.slug))));
	for (const { f, r } of yamls('eateries')) {
		const tag = `${f} :: ${r.slug}`;
		const p = eschema.safeParse(r);
		if (!p.success) {
			fail('eateries', tag, reason(p.error));
			continue;
		}
		const x = p.data;
		if (seen.has(`eatery:${x.slug}`)) {
			fail('eateries', tag, 'slug repeated');
			continue;
		}
		seen.add(`eatery:${x.slug}`);
		const soft = softChecks({
			mr: [x.name_mr, x.description.mr as string],
			hi: [x.name_hi, x.description.hi as string],
			long: LANGS.map((l) => x.description[l] as string)
		});
		soft.forEach((w) => warnings.push(`eatery ${x.slug}: ${w}`));
		const flag = flagOf(x._review);
		const needs = [flag, ...soft].filter((s): s is string => !!s);
		await guarded(client, 'eateries', tag, async () => {
			const apps = Object.fromEntries(
				Object.entries(x.food_apps)
					.map(([k, v]) => [k, compact(v as Row)] as const)
					.filter(([, v]) => Object.keys(v).length)
			);
			const { id, state } = await upsert(
				client, 'eateries', 'eateries', { slug: x.slug },
				{
					taluka_id: x.taluka, authenticity: x.authenticity, price_for_two: x.price_for_two,
					diet_flags: compact(x.diet_flags), food_apps: apps, menu: x.menu.items.length ? x.menu : null,
					phone: x.phone, whatsapp: x.whatsapp
				},
				x.lat == null ? null : [x.lng!, x.lat],
				{ status: flag ? 'draft' : 'in_review' }
			);
			if (state === 'skip') return;
			if (needs.length) held.push(`eatery ${x.slug}: ${needs.join('; ')}`);
			await names(client, 'eatery_translations', 'eatery_id', id, { en: x.name_en, mr: x.name_mr });
			await hours(client, 'eatery_hours', 'eatery_id', id, hoursOf(x));
			for (const d of x.dishes)
				await upsert(client, 'eatery_dishes', 'eatery_dishes', { eatery_id: id, dish_id: dishIds.get(d.slug) },
					{ is_signature: d.is_signature, is_best_for: d.is_best_for }, undefined);
			const want: Record<string, string> = {};
			for (const l of LANGS) if (x.description[l]) want[`${l}.description`] = x.description[l] as string;
			if (x.name_hi) want['hi.name'] = x.name_hi;
			const snap = await drafts(client, 'eatery', id, want, await priorDrafts(client, 'eatery', x.slug));
			await audit(client, 'eatery', x.slug, f, {
				_sources: x._sources, _review: x._review, _collected_by: x._collected_by, area: x.area,
				google_place_id: x.google_place_id, _drafts: snap
			}, needs);
		});
	}

	// Stays (no pins yet: S1). A price found online is `listed_online` (Q10); `owner` only when the owner confirms.
	// OTA pages become plain stay_offers (Q12). Amenities, network and is_verified are field-only: never set.
	const sschema = staySchema(ctx);
	for (const { f, r } of yamls('stays')) {
		const tag = `${f} :: ${r.slug}`;
		const p = sschema.safeParse(r);
		if (!p.success) {
			fail('stays', tag, reason(p.error));
			continue;
		}
		const x = p.data;
		if (seen.has(`stay:${x.slug}`)) {
			fail('stays', tag, 'slug repeated');
			continue;
		}
		seen.add(`stay:${x.slug}`);
		const soft = softChecks({
			mr: [x.name_mr, x.description.mr as string],
			hi: [x.name_hi, x.description.hi as string],
			long: LANGS.map((l) => x.description[l] as string)
		});
		soft.forEach((w) => warnings.push(`stay ${x.slug}: ${w}`));
		const flag = flagOf(x._review);
		const needs = [flag, ...soft].filter((s): s is string => !!s);
		const priced = x.price_min != null || x.price_max != null;
		await guarded(client, 'stays', tag, async () => {
			const { id, state } = await upsert(
				client, 'stays', 'stays', { slug: x.slug },
				{
					taluka_id: x.taluka, service_style: x.service_style, vibe_tags: x.vibe_tags,
					food_at_stay: compact(x.food_at_stay), price_min: x.price_min, price_max: x.price_max,
					price_source: priced ? (x.price_source ?? 'listed_online') : null, phone: x.phone, whatsapp: x.whatsapp
				},
				x.lat == null ? null : [x.lng!, x.lat],
				{ status: flag ? 'draft' : 'in_review' }
			);
			if (state === 'skip') return;
			if (needs.length) held.push(`stay ${x.slug}: ${needs.join('; ')}`);
			await names(client, 'stay_translations', 'stay_id', id, { en: x.name_en, mr: x.name_mr });
			for (const o of x.ota_links)
				await upsert(client, 'stay_offers', 'stay_offers', { stay_id: id, provider: o.provider, deep_link: o.url }, {}, undefined);
			const want: Record<string, string> = {};
			for (const l of LANGS) if (x.description[l]) want[`${l}.description`] = x.description[l] as string;
			if (x.name_hi) want['hi.name'] = x.name_hi;
			const snap = await drafts(client, 'stay', id, want, await priorDrafts(client, 'stay', x.slug));
			await audit(client, 'stay', x.slug, f, {
				_sources: x._sources, _review: x._review, _collected_by: x._collected_by, area: x.area,
				google_place_id: x.google_place_id, price_url: x.price_url, official_url: x.official_url, _drafts: snap
			}, needs);
		});
	}

	// Seasons: rows of their place (read only once the place is published).
	const seasonal = load('seasonal/place_seasonal.yaml');
	const filed = seasonal.map((s) => `${s.place}|${s.season}|${s.from_month}|${s.to_month}`);
	if (canon([...inline].sort()) !== canon([...filed].sort()))
		warnings.push('seasons in places/*.yaml differ from seasonal/place_seasonal.yaml (the file is imported)');
	for (const r of seasonal) {
		const tag = `${r.place}/${r.season}`;
		const p = seasonalSchema.safeParse(r);
		if (!p.success) {
			fail('place_seasonal', tag, reason(p.error));
			continue;
		}
		const place = placeIds.get(p.data.place);
		if (!place) {
			fail('place_seasonal', tag, 'place slug not imported');
			continue;
		}
		if (place.published) {
			bump('place_seasonal', 'skip');
			continue;
		}
		await guarded(client, 'place_seasonal', tag, async () => {
			await upsert(client, 'place_seasonal', 'place_seasonal', { place_id: place.id, season: p.data.season },
				{ from_month: p.data.from_month, to_month: p.data.to_month }, undefined);
		});
	}

	// Events: draft until an admin publishes them in /admin/events (S2).
	const evschema = eventSchema(ctx);
	for (const r of load('events/events-2026-27.yaml')) {
		const n = (r.name as Row | undefined)?.en;
		const tag = `${n} ${r.from_date}`;
		const p = evschema.safeParse(r);
		if (!p.success) {
			fail('events_calendar', tag, reason(p.error));
			continue;
		}
		const x = p.data;
		const key = `${x.name.en}|${x.from_date}|${(r.taluka as string | null) ?? 'district'}`;
		await guarded(client, 'events_calendar', tag, async () => {
			const { state } = await upsert(
				client, 'events_calendar', 'events_calendar', { name_en: x.name.en, from_date: x.from_date, taluka_id: x.taluka },
				{ name_mr: x.name.mr, name_hi: x.name.hi, type: x.type, to_date: x.to_date, impact: compact(x.impact) },
				undefined,
				{ status: 'draft' }
			);
			if (state !== 'skip')
				await audit(client, 'event', key, 'events/events-2026-27.yaml', { _sources: x._sources, _review: x._review }, []);
		});
	}

	// Hospitals and police: YAML names kept beside the OSM rows; phones not written until verified by call (C2).
	const urows = load('utilities/hospitals-police.yaml');
	const osm = new Map(
		(
			await client.query(`select type::text, osm_id::text, name from public.utility_pois where source = 'osm' and osm_id = any($1)`, [
				urows.filter((u) => u.osm_id).map((u) => osmKey(String(u.osm_id)))
			])
		).rows.map((u) => [`${u.type}:${u.osm_id}`, u.name as string | null])
	);
	for (const r of urows) {
		const p = utilitySchema.safeParse(r);
		const tag = `${r.type} ${r.osm_id ?? '(no osm_id)'} ${r.name}`;
		if (!p.success) {
			fail('utilities (audit)', tag, reason(p.error));
			continue;
		}
		const x = p.data;
		const key = x.osm_id ? `${x.type}:${osmKey(x.osm_id)}` : `${x.type}:name:${x.name}`;
		const osmName = x.osm_id ? osm.get(key) : undefined;
		if (x.osm_id && osmName === undefined) warnings.push(`utility ${tag}: osm_id not in utility_pois`);
		utilityLines.push(`${x.type.padEnd(8)} ${String(x.osm_id ?? '-').padEnd(16)} OSM: ${osmName ?? '-'}  |  YAML: ${x.name}`);
		const { phone: _phone, ...rest } = x;
		await guarded(client, 'utilities (audit)', tag, async () => {
			const state = await audit(client, 'utility', key, 'utilities/hospitals-police.yaml', { ...rest, osm_name: osmName ?? null }, [
				'phone to be verified by call before import (C2)'
			]);
			bump('utilities (audit)', state);
		});
	}

	// Not imported in this run.
	const trips = load('itineraries/itineraries.yaml').length;
	notes.push(`itineraries: ${trips} not imported (made in the planner and promoted, DECISIONS P7-15)`);
	notes.push('reference.yaml: nothing to write (fuel price and mileage are null; tide station links have no write path, M3)');

	// Photos: checked here; files are downloaded only with --apply --photos.
	for (const r of load('photos/manifest.yaml')) {
		const p = photoSchema.safeParse(r);
		if (!p.success) {
			fail('photos', String(r.slug), reason(p.error));
			continue;
		}
		const place = placeIds.get(p.data.slug);
		if (!place) {
			fail('photos', p.data.slug, 'place slug not imported');
			continue;
		}
		photos.push({ ...p.data, entity_id: place.id });
	}

	await client.query(apply ? 'commit' : 'rollback');
} catch (e) {
	await client.query('rollback').catch(() => {});
	throw e;
}

// ---------------------------------------------------------------- photos + report
const out: string[] = [];
const say = (s = '') => (console.log(s), out.push(s));
say(`desk import ${apply ? 'APPLIED' : 'DRY RUN (rolled back, nothing written)'} — local stack, ${new Date().toISOString()}`);
say();
if (dry) {
	const s = await photoSizes(photos);
	say(`photos: ${photos.length} to download, ${(s.bytes / 1048576).toFixed(1)} MB at source (HEAD), ${s.failed.length} not reachable`);
	s.failed.forEach((f) => say(`  ! ${f}`));
} else if (args.includes('--photos')) {
	const r = await importPhotos(client, photos, owner!);
	(['insert', 'skip', 'reject'] as const).forEach((k) => {
		for (let i = 0; i < r[k]; i++) bump('photos', k);
	});
	r.failed.forEach((f) => failures.push(`photos ${f}`));
} else say(`photos: ${photos.length} checked; run again with --apply --photos --photo-owner <email> to download`);
await client.end();

say();
say(`${'entity'.padEnd(22)} ${['insert', 'update', 'unchanged', 'skip', 'reject'].map((h) => h.padStart(9)).join('')}`);
for (const [e, c] of counts)
	say(`${e.padEnd(22)} ${[c.insert, c.update, c.unchanged, c.skip, c.reject].map((n) => String(n).padStart(9)).join('')}`);
say();
notes.forEach((n) => say(`not imported — ${n}`));
say();
say(`validation failures (${failures.length}):`);
failures.forEach((f) => say(`  ✗ ${f}`));
say();
say(`warnings (${warnings.length}):`);
warnings.forEach((w) => say(`  ⚠ ${w}`));
say();
say(`flagged for review — "Check first" (${held.length}):`);
held.forEach((h) => say(`  • ${h}`));
say();
say(`hospitals and police — OSM name | YAML name (${utilityLines.length}; phones not imported, C2):`);
utilityLines.forEach((u) => say(`  ${u}`));
writeFileSync(join(DATA, 'desk-import-report.txt'), out.join('\n') + '\n');
console.log(`\nreport → ${join(DATA, 'desk-import-report.txt')}`);
