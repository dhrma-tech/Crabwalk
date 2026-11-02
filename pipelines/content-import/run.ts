// Desk content importer (DECISIONS T-6 / T-50, Report 1 §1.4): one CSV row per place researched online.
// Each new row becomes an `in_review` place marked desk with its sources, its names, its hours, and its long
// English text as content_drafts — a reviewer still edits and publishes it in /admin/review; nothing goes live
// here. Idempotent by slug: a slug already in the database is skipped. Dry run by default (the same inserts run
// inside a transaction that is rolled back, so database errors show up too); --apply writes. Like every pipeline,
// --live targets the hosted project. Rejected rows → data/content-import-rejected.csv (sheet row + reason).
// Usage: node content-import/run.ts <file.csv> [--apply] [--live]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA, db, logger, target } from '../lib/common.ts';
import { parseCsv, records } from './csv.ts';
import { COLUMNS, DRAFT_FIELDS, hoursOf, reason, rowSchema } from './schema.ts';

const log = logger('content-import');
const file = process.argv.slice(2).find((a) => !a.startsWith('--'));
const apply = process.argv.includes('--apply');
if (!file) {
	console.error('usage: node content-import/run.ts <file.csv> [--apply] [--live]');
	process.exit(1);
}
const text = readFileSync(file, 'utf8');
const header = (parseCsv(text)[0] ?? []).map((h) => h.trim());
const missing = COLUMNS.filter((c) => !header.includes(c));
if (missing.length) {
	log(`missing columns: ${missing.join(', ')} (see content-import/template.csv)`);
	process.exit(1);
}
const rows = records(text);

const client = await db();
const rejected: { line: number; slug: string; reason: string }[] = [];
let added = 0;
let existing = 0;
try {
	const categories = (
		await client.query<{ c: string }>(`select unnest(enum_range(null::public.place_category))::text as c`)
	).rows.map((r) => r.c);
	const talukas = new Map(
		(await client.query<{ id: string; name_en: string }>(`select id, name_en from public.talukas`)).rows.map(
			(t) => [t.name_en.toLowerCase(), t.id]
		)
	);
	const schema = rowSchema({ categories, talukas });
	const seen = new Set<string>();

	await client.query('begin');
	for (const { line, data } of rows) {
		const reject = (why: string) => rejected.push({ line, slug: data.slug ?? '', reason: why });
		const p = schema.safeParse(data);
		if (!p.success) {
			reject(reason(p.error));
			continue;
		}
		const r = p.data;
		if (seen.has(r.slug)) {
			reject('slug repeated in this file');
			continue;
		}
		seen.add(r.slug);
		if ((await client.query('select 1 from public.places where slug = $1', [r.slug])).rowCount) {
			existing++;
			continue;
		}
		// When taluka boundaries are loaded, the point must fall inside the named taluka.
		const at = (await client.query<{ id: string | null }>('select public.taluka_at($1, $2) as id', [r.lng, r.lat]))
			.rows[0]!.id;
		if (at && at !== r.taluka) {
			reject('the point is outside that taluka');
			continue;
		}
		await client.query('savepoint row');
		try {
			const id = (
				await client.query<{ id: string }>(
					`insert into public.places (slug, category, taluka_id, location, entry_fee_text, entry_fee_inr,
					   visit_minutes, best_time_text, how_to_reach_text, nearest_station_text, nearest_bus_stop_text,
					   monsoon_status, monsoon_reason, is_tide_dependent, is_hidden_gem, status, verification_method,
					   source_urls, last_verified_at)
					 values ($1, $2, $3, extensions.st_setsrid(extensions.st_makepoint($4, $5), 4326)::extensions.geography,
					   $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'in_review', 'desk', $17, now())
					 returning id`,
					[
						r.slug, r.category, r.taluka, r.lng, r.lat, r.entry_fee_text, r.entry_fee_inr, r.visit_minutes,
						r.best_time, r.how_to_reach, r.nearest_station, r.nearest_bus_stop, r.monsoon_status,
						r.monsoon_reason, r.is_tide_dependent, r.is_hidden_gem, r.source_urls
					]
				)
			).rows[0]!.id;
			await client.query(
				`insert into public.place_translations (place_id, lang, name) values ($1, 'en', $2)` +
					(r.name_mr ? `, ($1, 'mr', $3)` : ''),
				r.name_mr ? [id, r.name_en, r.name_mr] : [id, r.name_en]
			);
			for (const h of hoursOf(r))
				await client.query(
					`insert into public.place_hours (place_id, weekday, opens, closes) values ($1, $2, $3, $4)`,
					[id, h.weekday, h.opens, h.closes]
				);
			for (const f of DRAFT_FIELDS)
				if (r[f])
					await client.query(
						`insert into public.content_drafts (entity_type, entity_id, lang, field, draft_text)
						 values ('place', $1, 'en', $2, $3)`,
						[id, f, r[f]]
					);
			await client.query('release savepoint row');
			added++;
		} catch (e) {
			await client.query('rollback to savepoint row');
			reject((e as Error).message);
		}
	}
	await client.query(apply ? 'commit' : 'rollback');
} catch (e) {
	await client.query('rollback').catch(() => {});
	throw e;
} finally {
	await client.end();
}

const out = join(DATA, 'content-import-rejected.csv');
const q = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
writeFileSync(out, ['row,slug,reason', ...rejected.map((x) => [x.line, x.slug, x.reason].map(q).join(','))].join('\n') + '\n');
log(
	`[${target()}] ${rows.length} rows: ${added} new ${apply ? 'written' : '(dry run, nothing written)'}, ` +
		`${existing} already there, ${rejected.length} rejected → ${out}`
);
if (!apply && added) log('Re-run with --apply to write them (they land as in_review drafts).');
