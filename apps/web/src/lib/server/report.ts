// Trip report (P12 step H, product plan 10.12). Built from our DB by template — the stories, timings, fees,
// dishes and stays already written for each listing — so it is fully detailed without generating text; the
// LLM only writes a short summary when a version is finalized. Missing facts are listed as Pending, never
// guessed. Business contacts are listing facts (shown to tripmates, never sent to the LLM); tripmates appear as a
// count only, so a shared report names nobody.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/db.types.ts';
import { msg } from '#lib/msg.ts';
import { nearby, photoUrls, photosFor, tr, type Lang } from './listings.ts';
import { addDays, istToday } from './planner/data.ts';
import { tripView } from './planner/trips.ts';
import type { Msg } from './ai/providers.ts';
import { chain, route } from './ai/router.ts';
import { personaRules } from './ai/persona.ts';

type DB = SupabaseClient<Database>;

export type ReportStop = {
	kind: string;
	name: string;
	href: string | null;
	arrive: string | null;
	depart: string | null;
	travelMin: number | null;
	reason: string | null;
	constraints: string[];
};
export type Report = {
	asOf: string;
	cover: {
		title: string;
		start: string | null;
		startDate: string | null;
		endDate: string | null;
		days: number;
		tripmates: number;
		budgetTotal: number | null;
		perPerson: number | null;
		people: number | null;
	};
	days: { day: number; date: string | null; stops: ReportStop[]; nearby: string[] }[];
	places: {
		name: string;
		href: string;
		photo: string | null;
		story: string | null;
		timings: string | null;
		fee: string | null;
		bestTime: string | null;
		dos: string | null;
		donts: string | null;
		safety: string | null;
		monsoon: string | null;
		lastVerified: string | null;
	}[];
	food: {
		name: string;
		href: string;
		signature: string[];
		priceForTwo: number | null;
		diet: string[];
	}[];
	dishes: { name: string; href: string; what: string | null }[];
	stays: {
		name: string;
		href: string;
		phone: string | null;
		price: string | null;
		amenities: string[];
		booking: { label: string; href: string }[];
		request: string | null;
	}[];
	expenses: {
		estimate: { label: string; amount: number }[] | null;
		total: number | null;
		actual: number;
	};
	practical: { tides: string[]; packing: string[] };
	pending: string[];
};

const keysOn = (j: unknown): string[] =>
	Array.isArray(j)
		? (j as string[])
		: j && typeof j === 'object'
			? Object.entries(j as Record<string, unknown>)
					.filter(([, v]) => v === true)
					.map(([k]) => k)
			: [];
const clock = (iso: string, lang: Lang) =>
	new Intl.DateTimeFormat(`${lang}-IN`, {
		hour: 'numeric',
		minute: '2-digit',
		timeZone: 'Asia/Kolkata'
	}).format(new Date(iso));
const hm = (t: string | null) => (t ? t.slice(0, 5) : null);

/** The live report for a trip, in `lang`. Null if the trip isn't visible to this user. */
export async function buildReport(db: DB, tripId: string, lang: Lang): Promise<Report | null> {
	const { data: t } = await db
		.from('trips')
		.select('*, trip_stops(*), trip_budget(*)')
		.eq('id', tripId)
		.maybeSingle();
	if (!t) return null;
	const budget = Array.isArray(t.trip_budget) ? (t.trip_budget[0] ?? null) : t.trip_budget;
	const view = await tripView(db, t, t.trip_stops, budget, lang);
	const ids = (type: string) => [
		...new Set(t.trip_stops.filter((s) => s.entity_type === type).map((s) => s.entity_id))
	];
	const pending: string[] = [];

	const [
		{ data: places },
		{ data: eateries },
		{ data: stays },
		{ count: mates },
		{ data: spends }
	] = await Promise.all([
		db
			.from('places')
			.select(
				'id, slug, category, entry_fee_inr, entry_fee_text, best_time_text, monsoon_status, monsoon_reason, last_verified_at, is_tide_dependent, tide_station_id, place_translations(lang, name, short_story, dos, donts, safety_text), place_hours(weekday, opens, closes, hours_unknown)'
			)
			.in('id', ids('place')),
		db
			.from('eateries')
			.select(
				'id, slug, price_for_two, diet_flags, eatery_translations(lang, name), eatery_dishes(is_signature, dishes(slug, dish_translations(lang, name, what_it_is)))'
			)
			.in('id', ids('eatery')),
		db
			.from('stays')
			.select(
				'id, slug, phone, whatsapp, price_min, price_max, amenities, stay_translations(lang, name), stay_offers(provider, deep_link)'
			)
			.in('id', ids('stay')),
		db.from('trip_members').select('id', { count: 'exact', head: true }).eq('trip_id', tripId),
		db.from('trip_expenses').select('amount').eq('trip_id', tripId)
	]);
	const photos = await photosFor(db, 'place', ids('place'));
	const placeById = new Map((places ?? []).map((p) => [p.id, p]));
	const dates = view.days.map((d) => d.date).filter((d): d is string => !!d);

	// Days: times, travel, reasons, and the Konkan-physics constraints behind each stop.
	const tideStations = [
		...new Set(
			(places ?? []).flatMap((p) =>
				p.is_tide_dependent && p.tide_station_id ? [p.tide_station_id] : []
			)
		)
	];
	const { data: tides } =
		tideStations.length && dates.length
			? await db
					.from('tide_cache')
					.select('station_id, date, extremes')
					.in('station_id', tideStations)
					.in('date', dates)
			: { data: [] };
	const tideText = (station: string | null, date: string | null) => {
		const row = (tides ?? []).find((x) => x.station_id === station && x.date === date);
		const ex = (row?.extremes ?? []) as { time: string; type: 'high' | 'low' }[];
		return ex.length
			? ex
					.map(
						(e) =>
							`${msg(e.type === 'high' ? 'tide_high' : 'tide_low', {}, lang)} ${clock(e.time, lang)}`
					)
					.join(', ')
			: null;
	};
	const practicalTides: string[] = [];
	const days = await Promise.all(
		view.days.map(async (d, k) => {
			const stops: ReportStop[] = d.stops.map((s) => {
				const p = s.entity_type === 'place' ? placeById.get(s.entity_id) : undefined;
				const constraints: string[] = [];
				if (p?.monsoon_status && p.monsoon_status !== 'open')
					constraints.push(
						`${msg(`monsoon_${p.monsoon_status}`, {}, lang)}${p.monsoon_reason ? ` — ${p.monsoon_reason}` : ''}`
					);
				if (p?.is_tide_dependent) {
					const tide = tideText(p.tide_station_id, d.date);
					constraints.push(
						tide ? `${msg('tide_dependent', {}, lang)}: ${tide}` : msg('tide_dependent', {}, lang)
					);
					if (tide) practicalTides.push(`${d.date} · ${s.name}: ${tide}`);
					else if (d.date) pending.push(msg('rep_pending_tides', { name: s.name ?? '' }, lang));
				}
				return {
					kind: s.kind,
					name: s.name ?? '?',
					href: s.href,
					arrive: s.arrive,
					depart: s.depart,
					travelMin: s.travelMin,
					reason: s.reason,
					constraints
				};
			});
			// Nearest hospital, ATM and fuel for the day (from its first stop).
			const pt = d.stops.find((s) => s.pt)?.pt;
			const near = pt ? (await nearby(db, pt.lon, pt.lat)).utilities : [];
			const pick = (type: string) => near.find((u) => u.type === type);
			const nearbyText = (['hospital', 'atm', 'fuel'] as const).flatMap((type) => {
				const u = pick(type);
				return u
					? [`${msg(`util_${type}`, {}, lang)}: ${u.name ?? '—'} (${u.km.toFixed(1)} km)`]
					: [];
			});
			return { day: k + 1, date: d.date, stops, nearby: nearbyText };
		})
	);

	// Places, in trip order.
	const order = t.trip_stops.slice().sort((a, b) => a.day - b.day || a.order - b.order);
	const placeList = [
		...new Set(order.filter((s) => s.entity_type === 'place').map((s) => s.entity_id))
	]
		.map((id) => placeById.get(id))
		.filter((p): p is NonNullable<typeof p> => !!p)
		.map((p) => {
			const t1 =
				p.place_translations.find((x) => x.lang === lang) ??
				p.place_translations.find((x) => x.lang === 'en');
			const name = tr(p.place_translations, lang) ?? p.slug;
			const day = view.days.findIndex((d) => d.stops.some((s) => s.entity_id === p.id));
			const date = view.days[day]?.date;
			const wd = date ? new Date(`${date}T00:00:00Z`).getUTCDay() : null;
			const h = wd != null ? p.place_hours.find((x) => x.weekday === wd) : p.place_hours[0];
			const timings =
				h && !h.hours_unknown && h.opens && h.closes ? `${hm(h.opens)}–${hm(h.closes)}` : null;
			if (!timings) pending.push(msg('rep_pending_timings', { name }, lang));
			const fee =
				p.entry_fee_text ??
				(p.entry_fee_inr != null
					? p.entry_fee_inr
						? `₹${p.entry_fee_inr}`
						: msg('rep_free', {}, lang)
					: null);
			if (!fee) pending.push(msg('rep_pending_fee', { name }, lang));
			const ph = photos.get(p.id)?.[0];
			return {
				name,
				href: `/place/${p.slug}`,
				photo: ph ? photoUrls(ph, name).src : null,
				story: t1?.short_story ?? null,
				timings,
				fee,
				bestTime: p.best_time_text,
				dos: t1?.dos ?? null,
				donts: t1?.donts ?? null,
				safety: t1?.safety_text ?? null,
				monsoon: p.monsoon_status ? msg(`monsoon_${p.monsoon_status}`, {}, lang) : null,
				lastVerified: p.last_verified_at?.slice(0, 10) ?? null
			};
		});

	// Food: eateries with signature dishes, then the Taste Konkan notes for those dishes.
	const dishes = new Map<string, { name: string; href: string; what: string | null }>();
	const food = (eateries ?? []).map((e) => {
		const signature = e.eatery_dishes
			.filter((x) => x.is_signature && x.dishes)
			.map((x) => {
				const d = x.dishes!;
				const dt =
					d.dish_translations.find((y) => y.lang === lang) ??
					d.dish_translations.find((y) => y.lang === 'en');
				if (dt)
					dishes.set(d.slug, {
						name: dt.name,
						href: `/taste-konkan/${d.slug}`,
						what: dt.what_it_is
					});
				return dt?.name ?? d.slug;
			});
		return {
			name: tr(e.eatery_translations, lang) ?? e.slug,
			href: `/food/${e.slug}`,
			signature,
			priceForTwo: e.price_for_two,
			diet: keysOn(e.diet_flags).map((k) =>
				msg(k === 'non_veg' ? 'diet_nonveg' : `diet_${k}`, {}, lang)
			)
		};
	});

	// Stays: contact, price range, amenities, booking links or the user's request status (10.2).
	const { data: requests } = stays?.length
		? await db
				.from('stay_requests')
				.select('entity_id, status')
				.in(
					'entity_id',
					stays.map((s) => s.id)
				)
				.order('created_at', { ascending: false })
		: { data: [] };
	const stayList = (stays ?? []).map((s) => {
		const name = tr(s.stay_translations, lang) ?? s.slug;
		const req = (requests ?? []).find((r) => r.entity_id === s.id);
		const price =
			s.price_min != null
				? `₹${s.price_min}${s.price_max && s.price_max !== s.price_min ? `–${s.price_max}` : ''}`
				: null;
		if (!price && !req) pending.push(msg('rep_pending_price', { name }, lang));
		if (req && ['sent', 'relayed'].includes(req.status))
			pending.push(msg('rep_pending_owner', { name }, lang));
		return {
			name,
			href: `/stays/${s.slug}`,
			phone: s.phone ?? s.whatsapp,
			price,
			amenities: keysOn(s.amenities).map((k) => msg(`amenity_${k}`, {}, lang)),
			booking: s.stay_offers.map((o) => ({ label: o.provider, href: o.deep_link })),
			request: req ? msg(`req_status_${req.status}`, {}, lang) : null
		};
	});

	// Open questions to our team about these places (10.1).
	const { data: asked } = await db
		.from('team_questions')
		.select('question')
		.eq('status', 'open')
		.in('entity_id', ids('place').length ? ids('place') : ['00000000-0000-0000-0000-000000000000']);
	for (const q of asked ?? [])
		pending.push(msg('rep_pending_team', { q: q.question.slice(0, 80) }, lang));

	// Packing list from what the trip includes, and the season.
	const cats = new Set((places ?? []).map((p) => p.category));
	const month = Number((t.start_date ?? istToday()).slice(5, 7));
	const pack = [
		'rep_pack_water',
		...(cats.has('beach') ? ['rep_pack_sun', 'rep_pack_swim'] : []),
		...(cats.has('waterfall') ? ['rep_pack_swim'] : []),
		...(['fort', 'cave', 'viewpoint', 'waterfall'].some((c) => cats.has(c as never))
			? ['rep_pack_shoes']
			: []),
		...(cats.has('cave') || cats.has('fort') ? ['rep_pack_torch'] : []),
		...(cats.has('temple') ? ['rep_pack_modest'] : []),
		...(month >= 6 && month <= 9 ? ['rep_pack_rain'] : []),
		'rep_pack_cash'
	];
	if (!t.start_date) pending.push(msg('rep_pending_dates', {}, lang));
	else if (Date.parse(t.start_date) - Date.parse(istToday()) > 2 * 864e5)
		pending.push(msg('rep_pending_weather', {}, lang));

	const b = view.budget;
	return {
		asOf: new Date().toISOString(),
		cover: {
			title: view.trip.title,
			start: view.trip.start,
			startDate: t.start_date,
			endDate: t.start_date ? addDays(t.start_date, t.days - 1).date : null,
			days: t.days,
			tripmates: mates ?? 1,
			budgetTotal: b?.total ?? null,
			perPerson: b?.perPerson ?? null,
			people: b?.people ?? null
		},
		days,
		places: placeList,
		food,
		dishes: [...dishes.values()],
		stays: stayList,
		expenses: {
			estimate: b
				? (['stay', 'food', 'fuel', 'entry', 'activities'] as const).map((k) => ({
						label: msg(`budget_${k}`, {}, lang),
						amount: b[k]
					}))
				: null,
			total: b?.total ?? null,
			actual: (spends ?? []).reduce((s, x) => s + x.amount, 0)
		},
		practical: { tides: practicalTides, packing: [...new Set(pack)].map((k) => msg(k, {}, lang)) },
		pending: [...new Set(pending)]
	};
}

const LANG_NAME: Record<Lang, string> = {
	en: 'English',
	hi: 'Hindi (Devanagari)',
	mr: 'Marathi (Devanagari)'
};

/** The short summary on a finalized version — the only LLM text in the report (product plan 10.12). */
export async function reportSummary(db: DB, r: Report, lang: Lang, persona: 'playful' | 'plain') {
	const { error } = await db.rpc('ai_take', { _feature: 'report' });
	if (error) return null;
	const facts = {
		title: r.cover.title,
		days: r.days.map((d) => ({ day: d.day, date: d.date, stops: d.stops.map((s) => s.name) })),
		food: r.food.map((f) => f.name),
		stays: r.stays.map((s) => s.name),
		pending: r.pending.length
	};
	const messages: Msg[] = [
		{
			role: 'system',
			content: `Write a 2–3 sentence summary of this trip for its report, in ${LANG_NAME[lang]}. Use ONLY the facts
given (names, days). No new facts, no prices, no phone numbers. ${personaRules(persona, lang)}`
		},
		{ role: 'user', content: JSON.stringify(facts).slice(0, 4000) }
	];
	const res = await route(chain('explain'), { messages, maxTokens: 200 }).catch(() => null);
	return res?.content.trim().slice(0, 1500) ?? null;
}
