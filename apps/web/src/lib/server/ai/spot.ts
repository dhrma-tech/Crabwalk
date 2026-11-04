// Crabby at the spot (P12 step F, product plan 10.3): the QR scan page opens Crabby preloaded with that place —
// its live status (monsoon, tides, alerts), do's & don'ts, what's nearby — and the user's trip for today. The same
// facts make the static FAQ for visitors who aren't signed in (chat needs login: quota rule). All from our DB.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/db.types.ts';
import { msg } from '#lib/msg.ts';
import { CODE_RE, resolveQr } from '../qr.ts';
import type { Lang } from '../listings.ts';
import { describeStops } from '../planner/trips.ts';
import { istToday } from '../planner/data.ts';

type DB = SupabaseClient<Database>;
export type Spot = {
	code: string;
	kind: 'place' | 'stay' | 'eatery';
	slug: string;
	name: string;
	href: string;
	/** Short facts in the reader's language (FAQ + the model's context). */
	facts: string[];
	near: string[];
};

const clockIST = (iso: string, lang: Lang) =>
	new Intl.DateTimeFormat(`${lang}-IN`, {
		hour: 'numeric',
		minute: '2-digit',
		timeZone: 'Asia/Kolkata'
	}).format(new Date(iso));

export async function spotContext(db: DB, code: string, lang: Lang): Promise<Spot | null> {
	if (!CODE_RE.test(code)) return null;
	const r = await resolveQr(db, code, lang);
	if (r.type !== 'listing') return null;
	const d = r.data;
	const s = d.safety;
	const facts = [
		...(s.monsoon
			? [
					`${msg(`monsoon_${s.monsoon}`, {}, lang)}${s.monsoonReason ? ` — ${s.monsoonReason}` : ''}`
				]
			: []),
		...s.alerts.map(
			(a) =>
				`${msg(`alert_${a.type}`, {}, lang)} · ${msg(`severity_${a.severity}`, {}, lang)}${a.reason ? ` — ${a.reason}` : ''}`
		),
		...(s.tideDependent
			? [
					s.tide?.extremes.length
						? `${msg('tide_dependent', {}, lang)}: ${s.tide.extremes
								.map(
									(e) =>
										`${msg(e.type === 'high' ? 'tide_high' : 'tide_low', {}, lang)} ${clockIST(e.time, lang)}`
								)
								.join(', ')}`
						: msg('tide_unavailable', {}, lang)
				]
			: []),
		...(s.text ? [s.text.slice(0, 300)] : []),
		...(d.dos ? [`${msg('place_dos', {}, lang)}: ${d.dos.slice(0, 300)}`] : []),
		...(d.donts ? [`${msg('place_donts', {}, lang)}: ${d.donts.slice(0, 300)}`] : [])
	];
	return {
		code: d.code,
		kind: d.kind as Spot['kind'],
		slug: d.href.split('/').pop()!,
		name: d.name,
		href: d.href,
		facts,
		near: d.near.slice(0, 6).map((n) => n.name)
	};
}

/** The user's trip for today (live or within its dates): today's remaining stops, for "What's next?". */
export async function todaysTrip(db: DB, userId: string, lang: Lang) {
	const today = istToday();
	const { data: joined } = await db.from('trip_members').select('trip_id').eq('user_id', userId);
	const { data: trips } = await db
		.from('trips')
		.select(
			'id, title, start_date, days, live_date, trip_stops(day, order, kind, entity_type, entity_id, arrive_at)'
		)
		.or([`owner_id.eq.${userId}`, ...(joined ?? []).map((j) => `id.eq.${j.trip_id}`)].join(','))
		.lte('start_date', today)
		.order('start_date', { ascending: false })
		.limit(5);
	const t = (trips ?? []).find((x) => {
		const day = Math.round((Date.parse(today) - Date.parse(x.start_date!)) / 864e5) + 1;
		return x.live_date === today || (day >= 1 && day <= x.days);
	});
	if (!t) return null;
	const day = Math.round((Date.parse(today) - Date.parse(t.start_date!)) / 864e5) + 1;
	const stops = t.trip_stops
		.filter(
			(s) => s.day === day && (!s.arrive_at || Date.parse(s.arrive_at) > Date.now() - 30 * 60e3)
		)
		.sort((a, b) => a.order - b.order);
	const info = await describeStops(db, stops, lang);
	return {
		id: t.id,
		title: t.title,
		day,
		next: stops
			.slice(0, 5)
			.map(
				(s) =>
					`${s.arrive_at ? `${clockIST(s.arrive_at, lang)} ` : ''}${info.get(s.entity_id)?.name ?? ''}`
			)
	};
}
