// Hardening T3-05: what Crabby's tools share — the turn context, schema helpers, listing lookups, the plan
// question cards and proposals. Each tool lives in its own file (tools/<name>.ts) as { def, run }; tools.ts is
// the registry.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/db.types.ts';
import { msg } from '#lib/msg.ts';
import { tr, type Lang } from '../../listings.ts';
import { addDays, istToday } from '../../planner/data.ts';
import { driveStep, type DriveStep } from '#lib/drive.ts';
import type { Question } from '#lib/questions.ts';
import type { Profile } from '../../profile.ts';
import { eateryFilter, placeFilter, readFilter, stayFilter } from '../../filters.ts';
import type { ToolDef } from '../providers.ts';

type DB = SupabaseClient<Database>;
export type ActionType =
	| 'create_plan'
	| 'edit_plan'
	| 'open_map'
	| 'start_nav'
	| 'shortlist_stays'
	| 'save_share'
	| 'add_to_trip'
	| 'ask_team'
	| 'send_request';
export type Preview = { title: string; lines: string[]; links?: { label: string; href: string }[] };
/** In a group chat (P12) the payload travels in the chat card instead of a private ai_actions row. */
export type Proposed = { id: string; type: ActionType; preview: Preview; payload?: unknown };
export type Ctx = {
	db: DB;
	userId: string;
	lang: Lang;
	/** Trip refs ("T1", "T2"…) → trip ids, so the model never sees uuids. */
	trips: Map<string, string>;
	proposed: Proposed[];
	/** Steps Crabby runs right away in the browser (P12 drive), checked against the allowlist in drive.ts. */
	drive: DriveStep[];
	/** The page the user is on, so Crabby can act in context (switchTab needs an open trip). */
	path: string | null;
	/** A question card for the user ("Ask, don't assume"); the turn stops and waits for the answers. */
	questions: Question[] | null;
	/** The user's profile (10.7) for planner defaults; null = none / not loaded. */
	profile: Profile | null;
	/** Crabby in a trip's group chat: proposals become chat cards any editor applies (P12 step G). */
	group?: boolean;
};

export const CATS = [
	'beach',
	'fort',
	'temple',
	'waterfall',
	'viewpoint',
	'backwater',
	'cave',
	'museum',
	'village',
	'market',
	'orchard'
] as const;
export const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
	type: 'object',
	properties,
	required
});
export const str = (description: string, extra: Record<string, unknown> = {}) => ({
	type: 'string',
	description,
	...extra
});
export const int = (description: string) => ({ type: 'integer', description });

/** A tool: its schema for the model and what it does. Arguments arrive parsed (tools.ts). */
export type Args = Record<string, unknown>;
export type Tool = { def: ToolDef; run: (ctx: Ctx, a: Args) => Promise<unknown> };
/** The string / integer readers every tool uses on its arguments. */
export const read = (a: Args) => ({
	s: (k: string) => (typeof a[k] === 'string' ? (a[k] as string) : undefined),
	i: (k: string) => (typeof a[k] === 'number' ? Math.round(a[k] as number) : undefined)
});

const FILTERS = { discover: placeFilter, stays: stayFilter, food: eateryFilter } as const;
/** The model's step → a checked DriveStep, or why it is refused (allowlist, unknown trip, bad filters). */
export function checkStep(ctx: Ctx, raw: Record<string, unknown>): DriveStep | string {
	const str = (k: string) => (typeof raw[k] === 'string' ? (raw[k] as string) : undefined);
	let step: unknown = { action: raw.action };
	switch (raw.action) {
		case 'openPage':
			step = { action: 'openPage', page: str('page') };
			break;
		case 'openListing':
			step = { action: 'openListing', type: str('type'), slug: str('slug') };
			break;
		case 'setFilters': {
			const page = str('page') as keyof typeof FILTERS;
			const params = new URLSearchParams(
				Object.entries((raw.filters ?? {}) as Record<string, unknown>).map(([k, v]) => [
					k,
					String(v)
				])
			);
			if (!(page in FILTERS) || !readFilter(FILTERS[page], params, true))
				return 'filters not allowed';
			step = { action: 'setFilters', page, filters: Object.fromEntries(params) };
			break;
		}
		case 'openMap':
			step = {
				action: 'openMap',
				...(str('slug')
					? { focus: { type: str('focus_type') ?? 'place', slug: str('slug') } }
					: {}),
				...(raw.alerts === true ? { alerts: true } : {})
			};
			break;
		case 'openTrip': {
			const id = ctx.trips.get(str('trip') ?? '');
			if (!id) return 'unknown trip ref — call list_my_trips first';
			step = { action: 'openTrip', trip: id };
			break;
		}
		case 'switchTab':
			if (!ctx.path?.startsWith('/plan/') || ctx.path === '/plan/new') return 'no trip is open';
			step = { action: 'switchTab', section: str('section'), ...(raw.day ? { day: raw.day } : {}) };
			break;
	}
	const r = driveStep.safeParse(step);
	return r.success ? r.data : 'not allowed';
}

export const n = (rows: { lang: string; name?: string | null }[] | null | undefined, lang: Lang) =>
	tr(rows ?? [], lang);
export const verdictText = (
	kind: string,
	level: number | null,
	pct: number | null,
	total: number,
	lang: Lang
) =>
	level && total >= 10
		? `${msg(`verdict_${kind}_${level}`, {}, lang)} (${Math.round((pct ?? 0) * 100)}% of ${total})`
		: total
			? `new (${total} votes)`
			: 'no votes yet';

export async function placeBySlug(db: DB, slug: string) {
	const { data } = await db
		.from('places')
		.select('id, slug, location, place_translations(lang, name)')
		.eq('slug', slug)
		.eq('status', 'published')
		.maybeSingle();
	return data;
}

const TR = {
	place: ['places', 'place_translations'],
	stay: ['stays', 'stay_translations'],
	eatery: ['eateries', 'eatery_translations']
} as const;
/** A published place / stay / eatery by slug with its names. */
export async function listingBySlug(db: DB, kind: keyof typeof TR, slug: string) {
	const [table, tr] = TR[kind];
	const { data } = await db
		.from(table)
		.select(`id, slug, names:${tr}(lang, name)`)
		.eq('slug', slug)
		.eq('status', 'published')
		.maybeSingle();
	return data as {
		id: string;
		slug: string;
		names: { lang: string; name: string | null }[];
	} | null;
}

// Plan question cards ("Ask, don't assume", §4): options from our data and enums, in the user's language.
export async function startQuestion(db: DB, lang: Lang): Promise<Question> {
	const { data: cfg } = await db
		.from('app_config')
		.select('value')
		.eq('key', 'plan_start_suggestions')
		.maybeSingle();
	const wanted = Array.isArray(cfg?.value) ? (cfg.value as string[]) : [];
	const { data } = await db
		.from('utility_pois')
		.select('name')
		.in('type', ['railway_station', 'bus_stand'])
		.in('name', wanted.length ? wanted : ['-'])
		.limit(8);
	const found = new Set((data ?? []).map((x) => x.name));
	const names = wanted.filter((w) => found.has(w)).slice(0, 4);
	if (names.length < 2) {
		const { data: any } = await db
			.from('utility_pois')
			.select('name')
			.eq('type', 'railway_station')
			.order('name')
			.limit(4);
		names.push(...(any ?? []).map((x) => x.name ?? '').filter(Boolean));
	}
	return {
		header: msg('plan_start', {}, lang),
		question: msg('q_start', {}, lang),
		options: names.slice(0, 4).map((label) => ({ label }))
	};
}
export const daysQuestion = (lang: Lang): Question => ({
	header: msg('plan_days', {}, lang),
	question: msg('q_days', {}, lang),
	options: [1, 2, 3, 4].map((n) => ({
		label: n === 1 ? msg('q_one_day', {}, lang) : msg('plan_n_days', { n }, lang),
		...(n === 2 ? { recommended: true } : {})
	})),
	decide: true
});
export function dateQuestion(lang: Lang): Question {
	const today = istToday();
	const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
	const sat = addDays(today, (6 - dow + 7) % 7 || 7).date;
	const fmt = (d: string) =>
		new Intl.DateTimeFormat(`${lang}-IN`, {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			timeZone: 'UTC'
		}).format(new Date(`${d}T00:00:00Z`));
	const tomorrow = addDays(today, 1).date;
	return {
		header: msg('q_when_header', {}, lang),
		question: msg('q_when', {}, lang),
		options: [
			{ label: `${msg('q_tomorrow', {}, lang)} (${fmt(tomorrow)})` },
			...(sat !== tomorrow ? [{ label: fmt(sat) }] : []),
			{ label: fmt(addDays(sat, 7).date) }
		]
	};
}
export const groupQuestion = (lang: Lang): Question => ({
	header: msg('q_group_header', {}, lang),
	question: msg('plan_group', {}, lang),
	options: (['family', 'couple', 'solo', 'friends'] as const).map((g) => ({
		label: msg(`group_${g}`, {}, lang)
	}))
});
export const paceQuestion = (lang: Lang): Question => ({
	header: msg('plan_pace', {}, lang),
	question: msg('q_pace', {}, lang),
	options: (['relaxed', 'balanced', 'packed'] as const).map((p) => ({
		label: msg(`pace_${p}`, {}, lang),
		...(p === 'balanced' ? { recommended: true } : {})
	})),
	decide: true
});

/** "Ask our team" (10.1): a preview with the promised wait; applying it files the question for verifiers. */
export async function proposeAskTeam(ctx: Ctx, question: string, place?: string) {
	const q = question.trim().slice(0, 500);
	if (q.length < 3) return { error: 'empty question' };
	const p = place ? await placeBySlug(ctx.db, place) : null;
	const name = p ? (n(p.place_translations, ctx.lang) ?? p.slug) : null;
	return propose(
		ctx,
		'ask_team',
		{
			title: msg('team_ask_title', {}, ctx.lang),
			lines: [`“${q}”`, ...(name ? [name] : []), msg('team_wait', {}, ctx.lang)]
		},
		{ question: q, lang: ctx.lang, ...(p ? { entity_type: 'place', entity_id: p.id } : {}) }
	);
}

export async function propose(ctx: Ctx, type: ActionType, preview: Preview, payload: unknown) {
	if (ctx.group) {
		ctx.proposed.push({ id: crypto.randomUUID(), type, preview, payload });
		return {
			proposed: type,
			title: preview.title,
			note: 'Posted as a card in the group chat; any editor can apply it.'
		};
	}
	const { data, error } = await ctx.db
		.from('ai_actions')
		.insert({ user_id: ctx.userId, type, preview: { ...preview, payload } as never })
		.select('id')
		.single();
	if (error) throw error;
	ctx.proposed.push({ id: data.id, type, preview });
	return {
		proposed: type,
		title: preview.title,
		note: 'Shown to the user with Apply / Discard. Nothing changes until they tap Apply.'
	};
}

export const today = () => new Date(Date.now() + 5.5 * 3600e3).getUTCDay();
