// PLAN P10 task 6: remove all is_seed data from production. Dry run by default (counts only);
// --apply deletes in one transaction (--simulate: same, then rolls back). Child tables with a foreign key cascade; rows that point at a seeded
// listing through a polymorphic entity_id (photos, ratings, QR codes, matrix points, trip stops…) are
// deleted explicitly. Usage: node seed-cleanup/run.ts [--live] [--apply]
import { db, logger, target } from '../lib/common.ts';

const log = logger('seed-cleanup');
// --simulate runs the full delete (FK cascades + checks) and then rolls back — for testing the script.
const simulate = process.argv.includes('--simulate');
const apply = process.argv.includes('--apply') || simulate;

// listing tables with is_seed → the entity_type value other tables use for them
const LISTINGS = [
	{ table: 'places', type: 'place' },
	{ table: 'stays', type: 'stay' },
	{ table: 'eateries', type: 'eatery' },
	{ table: 'dishes', type: 'dish' }
];
const POLY = [
	'photos', 'verdicts', 'verdict_agg', 'sub_scores', 'reviews', 'review_summaries', 'verified_visits',
	'booking_proofs', 'content_drafts', 'owner_claims', 'qr_codes', 'reports', 'sponsors', 'matrix_points',
	'trip_stops', 'group_votes', 'user_roles'
];

const client = await db();
try {
	await client.query('begin');
	const seeded = await client.query<{ id: string }>(
		LISTINGS.map((l) => `select id from public.${l.table} where is_seed`).join(' union all ')
	);
	const ids = seeded.rows.map((r) => r.id);
	log(`[${target()}] seeded listings: ${ids.length}`);
	for (const l of LISTINGS) {
		const n = (await client.query(`select count(*) from public.${l.table} where is_seed`)).rows[0].count;
		log(`  ${l.table}: ${n}`);
	}
	const plan: [string, number][] = [];
	for (const t of POLY) {
		const n = Number((await client.query(`select count(*) from public.${t} where entity_id = any($1::uuid[])`, [ids])).rows[0].count);
		if (n) plan.push([t, n]);
	}
	for (const [t, n] of plan) log(`  ${t} rows pointing at seeded listings: ${n}`);
	if (!apply) {
		log('dry run — nothing deleted. Re-run with --apply to delete.');
		await client.query('rollback');
	} else {
		for (const [t] of plan) await client.query(`delete from public.${t} where entity_id = any($1::uuid[])`, [ids]);
		// Translation tables carry their own is_seed for seeded text on real listings.
		for (const t of ['place_translations', 'stay_translations', 'eatery_translations', 'dish_translations'])
			await client.query(`delete from public.${t} where is_seed`);
		for (const l of LISTINGS) await client.query(`delete from public.${l.table} where is_seed`);
		const left = (await client.query(LISTINGS.map((l) => `select count(*) c from public.${l.table} where is_seed`).join(' union all '))).rows.reduce((s, r) => s + Number(r.c), 0);
		if (left) throw new Error(`${left} seeded rows still present`);
		await client.query(simulate ? 'rollback' : 'commit');
		if (simulate) log('simulation OK — rolled back');
		log(`[${target()}] ${simulate ? "would delete" : "deleted"} ${ids.length} seeded listings and ${plan.reduce((s, [, n]) => s + n, 0)} dependent rows`);
	}
} catch (e) {
	await client.query('rollback');
	throw e;
} finally {
	await client.end();
}
