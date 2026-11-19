// Hardening T2-07 (AI-02, AI Spec 5.7): Crabby eval runner. Local stack only.
//   pnpm --filter @crabwalk/web run ai:eval            (all cases with GROQ_API_KEY, else the structural ones)
//   pnpm --filter @crabwalk/web run ai:eval -- G1 V3   (only these cases)
// Loads supabase/seed/ai_eval.sql, signs in a throwaway eval user, runs every case through the real Crabby code
// (3 runs with a live model, a case passes on 2 of 3; 1 run on the mock), prints a table and exits non-zero below
// the thresholds. Never connects to a hosted project: URL and keys come from `supabase status` of the local stack.
import { registerHooks } from 'node:module';
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
if (existsSync(`${root}.env`)) process.loadEnvFile(`${root}.env`);

// The AI code reads SvelteKit's $app/env modules; outside Vite they are this process's environment.
const ENV_NAMES = [
	...['AI_PROVIDER', 'AI_MODEL_INTENT', 'AI_MODEL_EXPLAIN', 'AI_MODEL_DRAFT', 'AI_MODEL_VISION'],
	...['GROQ_API_KEY', 'GEMINI_API_KEY', 'CRABBY_SIGNING_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'],
	...['SUPABASE_SERVICE_ROLE_KEY', 'PUBLIC_ORIGIN', 'PMTILES_BASE_URL', 'RATE_LIMIT_SALT'],
	...['AGODA_ENABLED', 'AGODA_API_KEY', 'AGODA_PARTNER_ID', 'OLA_PROXY_URL', 'TURNSTILE_SITE_KEY'],
	...['VAPID_PUBLIC_KEY', 'DEV_BYPASS_AUTH']
];
registerHooks({
	resolve(spec, ctx, next) {
		if (/^\$app\/env(\/private|\/public)?$/.test(spec))
			return { url: `crabwalk-env:${spec}`, shortCircuit: true };
		return next(spec, ctx);
	},
	load(url, ctx, next) {
		if (!url.startsWith('crabwalk-env:')) return next(url, ctx);
		const source = url.endsWith('$app/env')
			? 'export const dev = false, building = false, version = "eval";'
			: ENV_NAMES.map((n) => `export const ${n} = ${JSON.stringify(process.env[n] ?? '')};`).join(
					'\n'
				);
		return { format: 'module', source, shortCircuit: true };
	}
});

// Local stack only.
const status = JSON.parse(
	execSync('pnpm exec supabase status -o json', { cwd: root, encoding: 'utf8' })
) as { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string };
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(status.API_URL))
	throw new Error('ai-eval runs against the local Supabase stack only');
process.env.SUPABASE_URL = status.API_URL;
process.env.SUPABASE_ANON_KEY = status.ANON_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY;
// The local dev value seeded into Vault (supabase/seed/seed.sql); Crabby signs its group messages with it.
process.env.CRABBY_SIGNING_KEY = 'local-dev-crabby-key';
const live = !!process.env.GROQ_API_KEY && process.env.AI_PROVIDER !== 'mock';
if (!live) process.env.AI_PROVIDER = 'mock';

const { createClient } = await import('@supabase/supabase-js');
const { CASES, verdict } = await import('../src/lib/server/ai/evals/cases.ts');
const { runCase } = await import('../src/lib/server/ai/evals/harness.ts');
const { setBudget } = await import('../src/lib/server/ai/router.ts');
type Case = (typeof CASES)[number];
type Seen = Awaited<ReturnType<typeof runCase>>;

const psql = (sql: string, input?: string) =>
	execFileSync(
		'docker',
		[
			'exec',
			'-i',
			'supabase_db_crabwalk',
			'psql',
			'-U',
			'postgres',
			'-v',
			'ON_ERROR_STOP=1',
			'-qtA',
			...(input ? [] : ['-c', sql])
		],
		{ encoding: 'utf8', input }
	).trim();

const seed = readFileSync(`${root}supabase/seed/ai_eval.sql`, 'utf8');
psql('', seed);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, opts);
const run = Date.now().toString(36);
const email = `ai-eval-${run}@eval.local`;
const password = `eval-${crypto.randomUUID()}`;
const { data: made, error: madeErr } = await admin.auth.admin.createUser({
	email,
	password,
	email_confirm: true
});
if (madeErr || !made.user) throw madeErr ?? new Error('could not create the eval user');
const userId = made.user.id;
const db = createClient(status.API_URL, status.ANON_KEY, opts);
const { error: signErr } = await db.auth.signInWithPassword({ email, password });
if (signErr) throw signErr;

// A saved 1-day trip (P4, S5): Fort A, the rain museum and Temple B.
const tripId = psql(
	`insert into trips (owner_id, title, days, start_date, start_point, status)
	 values ('${userId}', 'Eval trip', 1, (now() at time zone 'Asia/Kolkata')::date + 7,
	         jsonb_build_object('label', 'Ratnagiri', 'lon', 73.33, 'lat', 16.99), 'saved') returning id`
).split('\n')[0]!;
psql(
	`insert into trip_stops (trip_id, day, "order", entity_type, entity_id, kind)
	 select '${tripId}', 1, row_number() over (order by p.slug)::smallint, 'place', p.id, 'place'
	 from places p where p.slug in ('eval-fort-a', 'eval-museum-rain', 'eval-temple-b')`
);
const stops = () =>
	psql(`select string_agg(entity_id::text || ':' || day || ':' || "order", ',' order by day, "order")
	      from trip_stops where trip_id = '${tripId}'`);

let calls = 0;
let budgeted = 0;
setBudget(async () => ++budgeted <= 2000);

let before = '';
let cardsBefore = 0;
async function prepare(c: Case) {
	// Each case starts with today's cap unused (C1 uses it up on purpose) and no reel lookups.
	psql(`insert into ai_usage (user_id, date, message_count)
	      values ('${userId}', (now() at time zone 'Asia/Kolkata')::date, ${c.setup === 'cap' ? 20 : 0})
	      on conflict (user_id, date) do update set message_count = excluded.message_count;
	      delete from ai_feature_usage where user_id = '${userId}';`);
	before = stops();
	cardsBefore = Number(
		psql(`select count(*) from trip_messages where trip_id = '${tripId}' and kind = 'card'`)
	);
}

const published = new Set(
	psql(`select distinct t.name from place_translations t join places p on p.id = t.place_id
	      where p.status = 'published'`).split('\n')
);
const publishedSlugs = new Set(
	psql(`select slug from places where status = 'published'`).split('\n')
);

async function observe(c: Case, s: Seen) {
	if (c.group === 'P') {
		const r = s.results.find((x) => x.tool === 'build_plan')?.result as
			{ days?: string[] } | undefined;
		const action =
			s.reply?.kind === 'answer' ? s.reply.actions.find((a) => a.type === 'create_plan') : null;
		const start = action
			? psql(`select preview->'payload'->>'start_date' from ai_actions where id = '${action.id}'`)
			: '';
		const days = (r?.days ?? []).map((line) =>
			line
				.replace(/^[^:]*:\s*/, '')
				.split(' → ')
				.map((x) => /^(\d{2}:\d{2}) (.+?)(?: \(.*\))?$/.exec(x.trim()))
				.filter((m): m is RegExpExecArray => !!m)
				.map((m) => ({ time: m[1]!, name: m[2]! }))
		);
		const outsideHours: string[] = [];
		days.forEach((stopsOfDay, k) => {
			if (!start) return;
			const wd = new Date(Date.parse(start) + k * 864e5).getUTCDay();
			for (const x of stopsOfDay) {
				const h = psql(`select coalesce(bool_or(h.hours_unknown), false) or bool_or(
				                  h.opens is not null and '${x.time}'::time between h.opens and h.closes)
				                from place_hours h join place_translations t on t.place_id = h.place_id
				                where t.name = '${x.name.replace(/'/g, "''")}' and h.weekday = ${wd}`);
				if (h === 'f') outsideHours.push(`${x.name} at ${x.time}`);
			}
		});
		s.extra.plan = {
			days,
			unknown: days
				.flat()
				.map((x) => x.name)
				.filter((n) => !published.has(n)),
			outsideHours
		};
	}
	if (c.setup === 'trip') s.extra.tripUnchanged = stops() === before;
	if (c.kind === 'group')
		s.extra.group = {
			newCards:
				Number(
					psql(`select count(*) from trip_messages where trip_id = '${tripId}' and kind = 'card'`)
				) - cardsBefore,
			crabbyText:
				psql(`select coalesce(body, '') from trip_messages where trip_id = '${tripId}' and from_crabby
			                  order by created_at desc limit 1`),
			stopsUnchanged: stops() === before
		};
	if (s.extra.reel)
		s.extra.reel.unknownSlugs = s.extra.reel.slugs.filter((x) => !publishedSlugs.has(x));
}

const only = process.argv.slice(2).filter((a) => /^[A-Z]\d$/.test(a));
const cases = CASES.filter((c) => (live || c.structural) && (!only.length || only.includes(c.id)));
const runs = live ? 3 : 1;
console.log(
	live
		? `Live run: ${cases.length} cases × ${runs} (a case passes on 2 of 3).`
		: `${process.env.GROQ_API_KEY ? 'AI_PROVIDER=mock' : 'No GROQ_API_KEY'}: structural cases only, on the mock provider (${cases.length} of ${CASES.length}). Set the key in .env for the full set.`
);

const passed = new Map<string, boolean>();
const rows: string[][] = [];
try {
	await runAll();
} finally {
	// Leave the local stack as it was: the eval user, its trip and the eval rows go (e2e suites must not see them).
	psql(`delete from trips where id = '${tripId}'`);
	await admin.auth.admin.deleteUser(userId);
	psql('', seed.split('-- @load')[0]);
}

async function runAll() {
	for (const c of cases) {
		const why: string[] = [];
		let ok = 0;
		for (let i = 0; i < runs; i++) {
			try {
				const s = await runCase(c, { db, userId, tripId, before: prepare, after: observe });
				calls += s.calls;
				const w = c.check(s);
				if (w && process.env.EVAL_DEBUG)
					console.log(c.id, JSON.stringify({ ...s, reply: s.reply }, null, 1));
				if (w) why.push(w);
				else ok++;
			} catch (e) {
				why.push(`error: ${e instanceof Error ? e.message : String(e)}`);
			}
		}
		const pass = ok >= Math.min(2, runs);
		passed.set(c.id, pass);
		rows.push([c.id, `${ok}/${runs}`, pass ? 'pass' : 'FAIL', why[0]?.slice(0, 90) ?? '']);
	}
}

const w = [4, 5, 5];
console.log(
	['case', 'runs', 'result', 'first failure'].map((x, k) => x.padEnd(w[k] ?? 0)).join(' ')
);
for (const r of rows) console.log(r.map((x, k) => x.padEnd(w[k] ?? 0)).join(' '));
const failures = verdict(passed, cases);
console.log(`Provider calls: ${calls}.`);
if (failures.length) {
	console.log(`Below the thresholds: ${failures.join('; ')}`);
	process.exit(1);
}
console.log('All thresholds met.');
