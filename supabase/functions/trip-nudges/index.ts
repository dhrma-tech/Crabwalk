// Every 5 min (pg_cron): time nudges for trips in live mode today (DECISIONS P9-3). When a stop's planned
// departure is within 15 min, push "Time to head to <next stop>" to the owner's subscriptions — at most one
// push per stop (trip_stops.nudged_at). Rules only; no LLM. Dead subscriptions (404/410) are removed.
import webpush from 'npm:web-push@3.6.7';
import { admin, authorized, json } from '../_shared/cron.ts';

const TEXT = {
	en: (p: string, t: string) => ({ title: `Time to head to ${p}`, body: `Leave by ${t} to stay on plan.` }),
	hi: (p: string, t: string) => ({ title: `${p} के लिए निकलने का समय`, body: `प्लान पर रहने के लिए ${t} तक निकलें।` }),
	mr: (p: string, t: string) => ({ title: `${p} कडे निघायची वेळ`, body: `प्लॅनप्रमाणे राहण्यासाठी ${t} पर्यंत निघा.` })
};
const istDate = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const istClock = (iso: string) =>
	new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(iso));

Deno.serve(async (req) => {
	if (!authorized(req)) return json({ error: 'unauthorized' }, 401);
	const pub = Deno.env.get('VAPID_PUBLIC_KEY');
	const priv = Deno.env.get('VAPID_PRIVATE_KEY');
	if (!pub || !priv) return json({ error: 'VAPID keys not set' }, 503);
	webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'https://crabwalk.local', pub, priv);

	const db = admin();
	const today = istDate();
	const { data: trips, error } = await db
		.from('trips')
		.select('id, owner_id, start_date, trip_stops(id, day, order, entity_type, entity_id, depart_at, nudged_at)')
		.eq('live_date', today);
	if (error) return json({ error: error.message }, 500);

	const now = Date.now();
	let sent = 0;
	let due = 0;
	for (const t of trips ?? []) {
		const day = t.start_date ? Math.round((Date.parse(today) - Date.parse(t.start_date)) / 864e5) + 1 : 1;
		const stops = (t.trip_stops as { id: string; day: number; order: number; entity_type: string; entity_id: string; depart_at: string | null; nudged_at: string | null }[])
			.filter((s) => s.day === day)
			.sort((a, b) => a.order - b.order);
		for (let i = 0; i < stops.length - 1; i++) {
			const s = stops[i]!;
			const dep = s.depart_at ? Date.parse(s.depart_at) : NaN;
			if (s.nudged_at || !(dep >= now && dep <= now + 15 * 60000)) continue;
			due++;
			const nx = stops[i + 1]!;
			const tr = { place: 'place_translations', stay: 'stay_translations', eatery: 'eatery_translations' }[nx.entity_type]!;
			const fk = `${nx.entity_type}_id`;
			const [{ data: names }, { data: prof }, { data: subs }] = await Promise.all([
				db.from(tr).select('lang, name').eq(fk, nx.entity_id),
				db.from('profiles').select('language').eq('id', t.owner_id).maybeSingle(),
				db.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', t.owner_id)
			]);
			const lang = (prof?.language ?? 'en') as keyof typeof TEXT;
			const name = (names ?? []).find((n) => n.lang === lang)?.name ?? (names ?? []).find((n) => n.lang === 'en')?.name ?? '';
			const msg = (TEXT[lang] ?? TEXT.en)(name, istClock(s.depart_at!));
			for (const sub of subs ?? []) {
				try {
					await webpush.sendNotification(
						{ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
						JSON.stringify({ ...msg, url: `/trip/live/${t.id}` }),
						{ TTL: 900 }
					);
					sent++;
				} catch (e) {
					const code = (e as { statusCode?: number }).statusCode;
					if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('id', sub.id);
				}
			}
			await db.from('trip_stops').update({ nudged_at: new Date().toISOString() }).eq('id', s.id);
		}
	}
	return json({ trips: trips?.length ?? 0, due, sent });
});
