// The only tools Crabby can call (BACKEND §11.3). All read our DB through the user's session (RLS);
// results carry slugs/names/facts only — never ids, phone numbers, coordinates or location history,
// and never Ola data. Actions are proposals (ai_actions) the user applies or discards.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/db.types.ts';
import { msg } from '#lib/msg.ts';
import { getDish, lonLat, nearby as nearbyListings, tr, type Lang } from '../listings.ts';
import { addDays, istToday } from '../planner/data.ts';
import { computeTrip, describeStops, planInput } from '../planner/trips.ts';
import type { ToolDef } from './providers.ts';

type DB = SupabaseClient<Database>;
export type ActionType =
	'create_plan' | 'edit_plan' | 'open_map' | 'start_nav' | 'shortlist_stays' | 'save_share';
export type Preview = { title: string; lines: string[]; links?: { label: string; href: string }[] };
export type Proposed = { id: string; type: ActionType; preview: Preview };
export type Ctx = {
	db: DB;
	userId: string;
	lang: Lang;
	/** Trip refs ("T1", "T2"…) → trip ids, so the model never sees uuids. */
	trips: Map<string, string>;
	proposed: Proposed[];
};

const CATS = [
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
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
	type: 'object',
	properties,
	required
});
const str = (description: string, extra: Record<string, unknown> = {}) => ({
	type: 'string',
	description,
	...extra
});
const int = (description: string) => ({ type: 'integer', description });

export const TOOL_DEFS: ToolDef[] = [
	{
		name: 'search_places',
		description: 'Find published places. Use for any question about spots to visit.',
		parameters: obj({
			category: str('Place category', { enum: CATS }),
			name: str('Part of a place name'),
			hidden_gem: { type: 'boolean' },
			limit: int('Max results (≤ 8)')
		})
	},
	{
		name: 'get_place',
		description:
			'Full verified facts for one place (hours today, fee, best time, how to reach, monsoon, story, dos/donts, safety, rating).',
		parameters: obj({ slug: str('Place slug from search_places') }, ['slug'])
	},
	{
		name: 'search_stays',
		description: 'Find published stays, optionally near a place.',
		parameters: obj({
			near_place: str('Place slug'),
			max_price: int('Max nightly ₹'),
			vibe: str('Vibe tag')
		})
	},
	{
		name: 'search_eateries',
		description: 'Find published eateries, optionally near a place or by diet.',
		parameters: obj({
			near_place: str('Place slug'),
			diet: str('Diet', { enum: ['veg', 'non_veg', 'jain'] }),
			max_price_for_two: int('Max ₹ for two')
		})
	},
	{
		name: 'get_dish',
		description: 'A Konkan dish: what it is, its story, where it is best.',
		parameters: obj({ slug: str('Dish slug') }, ['slug'])
	},
	{
		name: 'nearby',
		description: 'Stays, food and services (fuel, ATM, hospital, toilets…) near a place.',
		parameters: obj({ slug: str('Place slug') }, ['slug'])
	},
	{
		name: 'get_conditions',
		description:
			"Current monsoon status, today's tides and latest weather for a place, from our caches.",
		parameters: obj({ slug: str('Place slug') }, ['slug'])
	},
	{
		name: 'list_my_trips',
		description: "The user's saved trips (refs like T1 for edit_plan / save_share).",
		parameters: obj({})
	},
	{
		name: 'build_plan',
		description:
			'Plan a trip with our deterministic planner. Needs a start railway station or bus stand name. Returns a preview the user must apply.',
		parameters: obj(
			{
				days: int('1–7'),
				start: str('Railway station or bus stand name'),
				start_date: str('YYYY-MM-DD; default tomorrow'),
				interests: { type: 'array', items: str('category', { enum: CATS }) },
				pace: str('pace', { enum: ['relaxed', 'balanced', 'packed'] }),
				standout: { type: 'boolean', description: 'Prefer hidden gems and calm spots' },
				budget: int('Total ₹'),
				people: int('Group size'),
				group_type: str('group', { enum: ['family', 'couple', 'solo', 'friends'] }),
				diet: str('diet', { enum: ['veg', 'non_veg', 'jain'] })
			},
			['days', 'start']
		)
	},
	{
		name: 'edit_plan',
		description:
			'Change a saved trip: remove or add a place on a day, or move it. Returns a preview the user must apply.',
		parameters: obj(
			{
				trip: str('Trip ref, e.g. T1'),
				ops: {
					type: 'array',
					items: obj(
						{
							op: str('op', { enum: ['remove', 'add', 'move'] }),
							day: int('Day number'),
							place: str('Place slug'),
							to_day: int('Target day for move')
						},
						['op', 'day', 'place']
					)
				}
			},
			['trip', 'ops']
		)
	},
	{
		name: 'merge_group_votes',
		description:
			"Merge friends' votes on a trip into a proposed edit (drops places most voted down) with the tally.",
		parameters: obj({ trip: str('Trip ref, e.g. T1') }, ['trip'])
	},
	{
		name: 'propose_action',
		description:
			'Offer a one-tap action: open_map (place), start_nav (place), shortlist_stays (stay slugs), save_share (trip ref).',
		parameters: obj(
			{
				type: str('type', { enum: ['open_map', 'start_nav', 'shortlist_stays', 'save_share'] }),
				place: str('Place slug'),
				stays: { type: 'array', items: str('Stay slug') },
				trip: str('Trip ref')
			},
			['type']
		)
	}
];

const n = (rows: { lang: string; name?: string | null }[] | null | undefined, lang: Lang) =>
	tr(rows ?? [], lang);
const verdictText = (
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

async function placeBySlug(db: DB, slug: string) {
	const { data } = await db
		.from('places')
		.select('id, slug, location, place_translations(lang, name)')
		.eq('slug', slug)
		.eq('status', 'published')
		.maybeSingle();
	return data;
}

async function propose(ctx: Ctx, type: ActionType, preview: Preview, payload: unknown) {
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

const today = () => new Date(Date.now() + 5.5 * 3600e3).getUTCDay();

export async function runTool(ctx: Ctx, name: string, rawArgs: string): Promise<unknown> {
	let a: Record<string, unknown>;
	try {
		a = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
	} catch {
		return { error: 'arguments were not valid JSON' };
	}
	const { db, lang } = ctx;
	const s = (k: string) => (typeof a[k] === 'string' ? (a[k] as string) : undefined);
	const i = (k: string) => (typeof a[k] === 'number' ? Math.round(a[k] as number) : undefined);

	switch (name) {
		case 'search_places': {
			let q = db
				.from('places')
				.select(
					'slug, category, is_hidden_gem, monsoon_status, place_translations!inner(lang, name), talukas(name_en)'
				)
				.eq('status', 'published')
				.limit(Math.min(i('limit') ?? 6, 8));
			if (s('category')) q = q.eq('category', s('category') as (typeof CATS)[number]);
			if (a.hidden_gem === true) q = q.eq('is_hidden_gem', true);
			if (s('name')) q = q.ilike('place_translations.name', `%${s('name')!.replace(/[%_]/g, '')}%`);
			const { data } = await q;
			return (data ?? []).map((p) => ({
				slug: p.slug,
				name: n(p.place_translations, lang),
				category: p.category,
				hidden_gem: p.is_hidden_gem,
				monsoon: p.monsoon_status,
				taluka: (p.talukas as { name_en: string } | null)?.name_en ?? null
			}));
		}
		case 'get_place': {
			const { data: p } = await db
				.from('places')
				.select(
					'id, slug, category, entry_fee_text, entry_fee_inr, best_time_text, how_to_reach_text, nearest_station_text, monsoon_status, monsoon_reason, is_tide_dependent, is_hidden_gem, last_verified_at, place_translations(lang, name, short_story, dos, donts, safety_text), place_hours(weekday, opens, closes, hours_unknown), crowd_typical(weekday, level)'
				)
				.eq('slug', s('slug') ?? '')
				.eq('status', 'published')
				.maybeSingle();
			if (!p) return { found: false };
			const { data: v } = await db
				.from('verdict_agg_all')
				.select('winner_level, winner_pct, total')
				.eq('entity_type', 'place')
				.eq('entity_id', p.id)
				.maybeSingle();
			const t = (f: string) => tr(p.place_translations, lang, f as never);
			const h = p.place_hours.find((x) => x.weekday === today());
			return {
				found: true,
				slug: p.slug,
				name: t('name'),
				category: p.category,
				hidden_gem: p.is_hidden_gem,
				hours_today:
					!h || h.hours_unknown
						? 'not known'
						: !h.opens || !h.closes
							? 'closed'
							: `${h.opens.slice(0, 5)}–${h.closes.slice(0, 5)}`,
				crowd_today: p.crowd_typical.find((c) => c.weekday === today())?.level ?? 'not known',
				entry_fee: p.entry_fee_text,
				entry_fee_inr: p.entry_fee_inr,
				best_time: p.best_time_text,
				how_to_reach: p.how_to_reach_text,
				nearest_station: p.nearest_station_text,
				monsoon: p.monsoon_status,
				monsoon_reason: p.monsoon_reason,
				tide_dependent: p.is_tide_dependent,
				story: t('short_story'),
				dos: t('dos'),
				donts: t('donts'),
				safety: t('safety_text'),
				rating: verdictText(
					'place',
					v?.winner_level ?? null,
					v?.winner_pct ?? null,
					v?.total ?? 0,
					lang
				),
				last_verified: p.last_verified_at?.slice(0, 10) ?? null,
				link: `/place/${p.slug}`
			};
		}
		case 'search_stays':
		case 'search_eateries': {
			const stays = name === 'search_stays';
			const near = s('near_place') ? await placeBySlug(db, s('near_place')!) : null;
			const c = near ? lonLat(near.location) : null;
			let q = stays
				? db
						.from('stays')
						.select(
							'id, slug, location, price_min, price_max, price_source, vibe_tags, amenities, stay_translations(lang, name)'
						)
						.eq('status', 'published')
						.limit(40)
				: db
						.from('eateries')
						.select(
							'id, slug, location, price_for_two, diet_flags, authenticity, eatery_translations(lang, name)'
						)
						.eq('status', 'published')
						.limit(40);
			if (stays && i('max_price')) q = q.lte('price_min', i('max_price')!);
			if (stays && s('vibe')) q = q.contains('vibe_tags', [s('vibe')!]);
			if (!stays && s('diet')) q = q.contains('diet_flags', { [s('diet')!]: true });
			if (!stays && i('max_price_for_two')) q = q.lte('price_for_two', i('max_price_for_two')!);
			const dist = (p: [number, number]) =>
				c ? Math.hypot((p[0] - c[0]) * 106, (p[1] - c[1]) * 110.6) : 0;
			if (c) {
				// Near a place: take the nearest candidates inside the 15 km box first, so the row limit
				// can't drop close listings when a region has more than 40 (DECISIONS P10a found issue).
				const dLat = 15 / 110.6;
				const dLon = 15 / 106;
				const { data: pins } = await db.rpc('map_pins', {
					min_lon: c[0] - dLon,
					min_lat: c[1] - dLat,
					max_lon: c[0] + dLon,
					max_lat: c[1] + dLat,
					kinds: [stays ? 'stay' : 'eatery']
				});
				const ids = (pins ?? [])
					.sort((a, b) => dist([a.lon, a.lat]) - dist([b.lon, b.lat]))
					.slice(0, 40)
					.map((p) => p.id);
				q = q.in('id', ids);
			}
			const { data } = await q;
			const km = (l: unknown) => {
				const p = lonLat(l);
				return c && p ? Math.round(dist(p) * 10) / 10 : null;
			};
			type Row = Record<string, unknown> & { slug: string; location: unknown };
			return ((data ?? []) as Row[])
				.map((r) => ({ r, km: km(r.location) }))
				.filter((x) => !c || (x.km ?? 99) <= 15)
				.sort((x, y) => (x.km ?? 0) - (y.km ?? 0))
				.slice(0, 6)
				.map(({ r, km }) =>
					stays
						? {
								slug: r.slug,
								name: n(r.stay_translations as never, lang),
								price_min: r.price_min,
								price_max: r.price_max,
								price_source: r.price_source,
								vibe: r.vibe_tags,
								km,
								link: `/stays/${r.slug}`
							}
						: {
								slug: r.slug,
								name: n(r.eatery_translations as never, lang),
								price_for_two: r.price_for_two,
								diet: Object.keys((r.diet_flags as Record<string, boolean>) ?? {}).filter(
									(k) => (r.diet_flags as Record<string, boolean>)[k]
								),
								authenticity: r.authenticity,
								km,
								link: `/food/${r.slug}`
							}
				);
		}
		case 'get_dish': {
			const d = await getDish(db, s('slug') ?? '');
			if (!d) return { found: false };
			return {
				found: true,
				name: tr(d.dish_translations, lang),
				what_it_is: tr(d.dish_translations, lang, 'what_it_is'),
				story: tr(d.dish_translations, lang, 'story'),
				best_at: d.eatery_dishes.map((e) => ({
					name: n(e.eateries?.eatery_translations, lang),
					slug: e.eateries?.slug
				}))
			};
		}
		case 'nearby': {
			const p = await placeBySlug(db, s('slug') ?? '');
			const c = p ? lonLat(p.location) : null;
			if (!c) return { found: false };
			const r = await nearbyListings(db, c[0], c[1]);
			return {
				listings: r.listings.map((x) => ({
					kind: x.kind,
					slug: x.slug,
					name: (lang !== 'en' && x[`name_${lang}`]) || x.name_en,
					km: Math.round(x.km * 10) / 10
				})),
				services: r.utilities.map((u) => ({
					type: msg(`util_${u.type}`, {}, lang),
					name: u.name,
					km: Math.round(u.km * 10) / 10
				}))
			};
		}
		case 'get_conditions': {
			const { data: p } = await db
				.from('places')
				.select(
					'slug, monsoon_status, monsoon_reason, is_tide_dependent, tide_station_id, location'
				)
				.eq('slug', s('slug') ?? '')
				.eq('status', 'published')
				.maybeSingle();
			if (!p) return { found: false };
			const [{ data: tide }, { data: wx }] = await Promise.all([
				p.tide_station_id
					? db
							.from('tide_cache')
							.select('extremes')
							.eq('station_id', p.tide_station_id)
							.eq('date', istToday())
							.maybeSingle()
					: Promise.resolve({ data: null }),
				db
					.from('weather_cache')
					.select('summary, fetched_at, weather_points(location)')
					.gte('fetched_at', new Date(Date.now() - 3 * 3600e3).toISOString())
					.limit(40)
			]);
			const c = lonLat(p.location);
			const w = c
				? (wx ?? [])
						.map((x) => ({
							x,
							p: lonLat((x.weather_points as { location: unknown } | null)?.location)
						}))
						.filter((x) => x.p)
						.sort(
							(a, b) =>
								Math.hypot(a.p![0] - c[0], a.p![1] - c[1]) -
								Math.hypot(b.p![0] - c[0], b.p![1] - c[1])
						)[0]?.x
				: undefined;
			const sum = w?.summary as
				{ temp_c?: number; rain_1h_mm?: number; description?: string } | undefined;
			return {
				monsoon: p.monsoon_status,
				monsoon_reason: p.monsoon_reason,
				tide_dependent: p.is_tide_dependent,
				tides_today: (
					(tide?.extremes as { type: string; time: string; height_m: number }[] | null) ?? []
				).map((e) => ({
					type: e.type,
					time_ist: new Intl.DateTimeFormat('en-GB', {
						hour: '2-digit',
						minute: '2-digit',
						timeZone: 'Asia/Kolkata'
					}).format(new Date(e.time)),
					height_m: Math.round(e.height_m * 10) / 10
				})),
				weather: sum
					? {
							temp_c: sum.temp_c != null ? Math.round(sum.temp_c) : null,
							rain_last_hour_mm: sum.rain_1h_mm ?? 0,
							description: sum.description,
							as_of: w!.fetched_at.slice(11, 16) + ' UTC'
						}
					: 'no recent weather data'
			};
		}
		case 'list_my_trips': {
			const { data } = await db
				.from('trips')
				.select('id, title, days, start_date')
				.eq('owner_id', ctx.userId)
				.order('created_at', { ascending: false })
				.limit(10);
			return (data ?? []).map((t, k) => {
				const ref = `T${k + 1}`;
				ctx.trips.set(ref, t.id);
				return { ref, title: t.title, days: t.days, start_date: t.start_date };
			});
		}
		case 'build_plan': {
			const startName = s('start') ?? '';
			const { data: st } = await db
				.from('utility_pois')
				.select('name, location')
				.in('type', ['railway_station', 'bus_stand'])
				.ilike('name', `%${startName.replace(/[%_]/g, '')}%`)
				.limit(1)
				.maybeSingle();
			const c = st ? lonLat(st.location) : null;
			if (!st || !c)
				return { error: 'start not found — ask the user for a railway station or bus stand name' };
			const { data: pref } = await db
				.from('user_preferences')
				.select('diet, group_type')
				.eq('user_id', ctx.userId)
				.maybeSingle();
			const p = planInput.safeParse({
				days: i('days') ?? 2,
				start_date: s('start_date') ?? addDays(istToday(), 1).date,
				start: { label: st.name ?? startName, lon: c[0], lat: c[1] },
				group_type: s('group_type') ?? pref?.group_type ?? 'family',
				people: i('people') ?? 2,
				budget: i('budget') ?? null,
				interests: Array.isArray(a.interests) ? a.interests : [],
				pace: s('pace') ?? 'balanced',
				standout: a.standout === true,
				diet: s('diet') ?? pref?.diet ?? null
			});
			if (!p.success)
				return {
					error: 'invalid plan inputs',
					issues: p.error.issues.map((x) => x.path.join('.'))
				};
			const { days } = await computeTrip(db, p.data);
			const info = await describeStops(
				db,
				days.flatMap((d) =>
					d.stops.map((x) => ({
						entity_type: (x.kind === 'meal' ? 'eatery' : x.kind) as 'place',
						entity_id: x.id
					}))
				),
				lang
			);
			const hm = (t: number) =>
				`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
			const lines = days.map(
				(d, k) =>
					`${msg('plan_day_n', { n: k + 1 }, lang)}: ` +
					d.stops
						.filter((x) => x.kind === 'place')
						.map(
							(x) =>
								`${hm(x.arrive)} ${info.get(x.id)?.name ?? '?'}${x.reasons.length ? ` (${x.reasons.map((r) => msg(`reason_${r}`, {}, lang)).join(', ')})` : ''}`
						)
						.join(' → ')
			);
			const res = await propose(
				ctx,
				'create_plan',
				{
					title: msg('plan_default_title', { days: p.data.days, from: p.data.start.label }, lang),
					lines
				},
				p.data
			);
			return { ...res, days: lines };
		}
		case 'edit_plan':
		case 'merge_group_votes': {
			const tripId = ctx.trips.get(s('trip') ?? '');
			if (!tripId) return { error: 'unknown trip ref — call list_my_trips first' };
			const { data: t } = await db
				.from('trips')
				.select('id, title, days, trip_stops(day, order, kind, entity_type, entity_id)')
				.eq('id', tripId)
				.maybeSingle();
			if (!t) return { error: 'trip not found' };
			const order = Array.from({ length: t.days }, (_, d) =>
				t.trip_stops
					.filter((x) => x.day === d + 1)
					.sort((x, y) => x.order - y.order)
					.map((x) => ({ kind: x.kind, entity_id: x.entity_id }))
			);
			const info = await describeStops(db, t.trip_stops, lang);
			const slugOf = (id: string) => info.get(id)?.href?.split('/').at(-1);
			const changes: string[] = [];
			let tally: { place: string; up: number; down: number }[] = [];
			if (name === 'merge_group_votes') {
				const { data: votes } = await db
					.from('group_votes')
					.select('entity_id, vote')
					.eq('trip_id', t.id);
				const net = new Map<string, { up: number; down: number }>();
				for (const v of votes ?? []) {
					const x = net.get(v.entity_id) ?? { up: 0, down: 0 };
					x[v.vote as 'up' | 'down']++;
					net.set(v.entity_id, x);
				}
				tally = [...net].map(([id, x]) => ({ place: info.get(id)?.name ?? '?', ...x }));
				if (!tally.length) return { votes: 0, note: 'no group votes yet' };
				for (const day of order)
					for (let k = day.length - 1; k >= 0; k--) {
						const x = net.get(day[k]!.entity_id);
						if (day[k]!.kind === 'place' && x && x.down > x.up) {
							changes.push(`− ${info.get(day[k]!.entity_id)?.name} (${x.up}↑ ${x.down}↓)`);
							day.splice(k, 1);
						}
					}
				if (!changes.length)
					return { votes: tally, note: 'no place has more down than up votes; nothing to change' };
			} else {
				const ops = Array.isArray(a.ops) ? (a.ops as Record<string, unknown>[]) : [];
				for (const op of ops) {
					const day = Number(op.day) - 1;
					const slug = String(op.place ?? '');
					if (!order[day]) return { error: `day ${op.day} not in trip` };
					if (op.op === 'add') {
						const p = await placeBySlug(db, slug);
						if (!p) return { error: `place ${slug} not found` };
						const stay = order[day]!.findIndex((x) => x.kind === 'stay');
						order[day]!.splice(stay < 0 ? order[day]!.length : stay, 0, {
							kind: 'place',
							entity_id: p.id
						});
						changes.push(
							`+ ${n(p.place_translations, lang)} → ${msg('plan_day_n', { n: day + 1 }, lang)}`
						);
					} else {
						const k = order[day]!.findIndex(
							(x) => x.kind === 'place' && slugOf(x.entity_id) === slug
						);
						if (k < 0) return { error: `${slug} is not on day ${op.day}` };
						const [x] = order[day]!.splice(k, 1);
						if (op.op === 'move') {
							const to = Number(op.to_day) - 1;
							if (!order[to]) return { error: `day ${op.to_day} not in trip` };
							const stay = order[to]!.findIndex((y) => y.kind === 'stay');
							order[to]!.splice(stay < 0 ? order[to]!.length : stay, 0, x!);
							changes.push(
								`↔ ${info.get(x!.entity_id)?.name} → ${msg('plan_day_n', { n: to + 1 }, lang)}`
							);
						} else changes.push(`− ${info.get(x!.entity_id)?.name}`);
					}
				}
			}
			const res = await propose(
				ctx,
				'edit_plan',
				{ title: t.title, lines: changes },
				{ trip_id: t.id, days: order }
			);
			return { ...res, changes, ...(tally.length ? { votes: tally } : {}) };
		}
		case 'propose_action': {
			const type = s('type') as ActionType;
			if (type === 'open_map' || type === 'start_nav') {
				const p = await placeBySlug(db, s('place') ?? '');
				if (!p) return { error: 'place not found' };
				const nm = n(p.place_translations, lang) ?? p.slug;
				return propose(ctx, type, { title: nm, lines: [] }, { slug: p.slug, name: nm });
			}
			if (type === 'shortlist_stays') {
				const slugs = Array.isArray(a.stays) ? (a.stays as string[]).slice(0, 5) : [];
				const { data } = await db
					.from('stays')
					.select(
						'slug, price_min, stay_translations(lang, name), stay_offers(provider, deep_link)'
					)
					.in('slug', slugs)
					.eq('status', 'published');
				if (!data?.length) return { error: 'no stays found' };
				return propose(
					ctx,
					type,
					{
						title: msg('ai_shortlist', {}, lang),
						lines: data.map(
							(x) => `${n(x.stay_translations, lang)}${x.price_min ? ` · ₹${x.price_min}+` : ''}`
						),
						links: data.flatMap((x) => [
							{ label: n(x.stay_translations, lang) ?? x.slug, href: `/stays/${x.slug}` },
							...x.stay_offers.slice(0, 1).map((o) => ({
								label: `${n(x.stay_translations, lang)} · ${o.provider}`,
								href: o.deep_link
							}))
						])
					},
					{ slugs: data.map((x) => x.slug) }
				);
			}
			if (type === 'save_share') {
				const id = ctx.trips.get(s('trip') ?? '');
				if (!id) return { error: 'unknown trip ref — call list_my_trips first' };
				const { data: t } = await db.from('trips').select('title').eq('id', id).maybeSingle();
				return propose(ctx, type, { title: t?.title ?? '', lines: [] }, { trip_id: id });
			}
			return { error: 'unknown action type' };
		}
	}
	return { error: `unknown tool ${name}` };
}
