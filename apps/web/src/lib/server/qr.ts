// QR scan page data (BACKEND §9 [LOCKED]): one server round-trip, everything inlined, < 100 KB total.
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from '$app/env/public';
import type { Database } from '#lib/db.types.ts';
import { TIDE_ATTRIBUTION } from '#lib/tides.ts';
import { lonLat, names, photosFor, tr, type Lang } from './listings.ts';

type DB = SupabaseClient<Database>;
export type QrKind = 'place' | 'stay' | 'eatery';
export const CODE_RE = /^[A-Z]{2,5}-[0-9]{3,}$/;
export const SESSION_COOKIE = 'cw_qs';

export type Near = {
	kind: 'stay' | 'eatery' | 'utility' | 'place';
	sub: string | null;
	href: string | null;
	name: string;
	distance_m: number;
	minutes: number | null;
	phone: string | null;
};

export type QrData = {
	code: string;
	kind: QrKind;
	name: string;
	altName: string | null;
	href: string;
	photo: { src: string; alt: string } | null;
	audio: { src: string; transcript: string | null } | null;
	story: string | null;
	dos: string | null;
	donts: string | null;
	safety: {
		monsoon: 'open' | 'risky' | 'closed' | null;
		monsoonReason: string | null;
		text: string | null;
		tideDependent: boolean;
		tide: {
			extremes: { type: 'high' | 'low'; time: string; height_m: number }[];
			attribution: { text: string; url: string };
		} | null;
	};
	menu: string[];
	verdict: { level: number | null; pct: number | null; total: number; isNew: boolean } | null;
	reviews: { text: string; date: string }[];
	near: Near[];
	sponsor: string | null;
	coords: [number, number] | null;
};

export type Resolved =
	{ type: 'listing'; data: QrData } | { type: 'start'; code: string } | { type: 'missing' };

const istToday = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const HREF = { place: '/place/', stay: '/stays/', eatery: '/food/' } as const;
const TR = {
	place: 'place_translations',
	stay: 'stay_translations',
	eatery: 'eatery_translations'
};

/** Smallest photo variant only (480 px) — keeps the page inside the 2G budget. */
const smallPhoto = (p: { storage_path: string } | undefined, alt: string) =>
	p
		? { src: `${SUPABASE_URL}/storage/v1/object/public/photos/${p.storage_path}-480.webp`, alt }
		: null;

export async function resolveQr(db: DB, code: string, lang: Lang): Promise<Resolved> {
	const { data: q } = await db
		.from('qr_codes')
		.select('code, entity_type, entity_id, sponsors(name)')
		.eq('code', code)
		.maybeSingle();
	if (!q) return { type: 'missing' };
	if (q.entity_type === 'station' || q.entity_type === 'bus_stand') return { type: 'start', code };
	const kind = q.entity_type as QrKind;

	const listing = await loadListing(db, kind, q.entity_id, lang);
	if (!listing) return { type: 'missing' };
	const { data: near } = await db.rpc('qr_near_me', { _code: code });
	const n = names(listing.translations);
	const name = n[lang] || n.en;
	const t = (f: string) => tr(listing.translations, lang, f as never);

	return {
		type: 'listing',
		data: {
			code,
			kind,
			name,
			altName: lang === 'mr' ? (n.en !== name ? n.en : null) : n.mr && n.mr !== name ? n.mr : null,
			href: HREF[kind] + listing.slug,
			photo: smallPhoto(listing.hero, name),
			audio: listing.audio
				? {
						src: `${SUPABASE_URL}/storage/v1/object/public/audio/${listing.audio.storage_path}`,
						transcript: listing.audio.transcript
					}
				: null,
			story: t('short_story') ?? t('description'),
			dos: t('dos'),
			donts: t('donts'),
			safety: {
				monsoon: listing.monsoon,
				monsoonReason: listing.monsoonReason,
				text: t('safety_text'),
				tideDependent: listing.tideDependent,
				tide: listing.tide
			},
			menu: listing.menu,
			verdict: listing.verdict,
			reviews: listing.reviews,
			near: (near ?? []).map((x) => ({
				kind: x.kind as Near['kind'],
				sub: x.sub,
				href: x.slug ? HREF[x.kind as QrKind] + x.slug : null,
				name: (lang !== 'en' && x[`name_${lang}`]) || x.name_en || '',
				distance_m: x.distance_m,
				minutes: x.minutes,
				phone: x.phone
			})),
			sponsor: (q.sponsors as { name: string } | null)?.name ?? null,
			coords: listing.coords
		}
	};
}

async function loadListing(db: DB, kind: QrKind, id: string, lang: Lang) {
	const table = { place: 'places', stay: 'stays', eatery: 'eateries' }[kind];
	const cols = {
		place:
			'slug, location, monsoon_status, monsoon_reason, is_tide_dependent, tide_station_id, place_translations(lang, name, short_story, dos, donts, safety_text), audio_guides(lang, storage_path, transcript)',
		stay: 'slug, location, stay_translations(lang, name, description)',
		eatery: 'slug, location, menu, eatery_translations(lang, name, description)'
	}[kind];
	const { data: row } = await db
		.from(table as 'places')
		.select(cols)
		.eq('id', id)
		.eq('status', 'published')
		.maybeSingle();
	if (!row) return null;
	const r = row as unknown as Record<string, unknown> & { slug: string };
	const translations = r[TR[kind]] as { lang: string; name?: string | null }[];

	const [photos, agg, reviews, tide] = await Promise.all([
		photosFor(db, kind, [id]),
		kind === 'place'
			? Promise.resolve({ data: null })
			: db
					.from('verdict_agg_all')
					.select('total, winner_level, winner_pct, is_new')
					.eq('entity_type', kind)
					.eq('entity_id', id)
					.maybeSingle(),
		kind === 'place'
			? Promise.resolve({ data: [] })
			: db
					.from('reviews')
					.select('text, created_at')
					.eq('entity_type', kind)
					.eq('entity_id', id)
					.eq('moderation_status', 'approved')
					.not('text', 'is', null)
					.order('created_at', { ascending: false })
					.limit(3),
		r.is_tide_dependent && r.tide_station_id
			? db
					.from('tide_cache')
					.select('extremes, provider')
					.eq('station_id', r.tide_station_id as string)
					.eq('date', istToday())
					.maybeSingle()
			: Promise.resolve({ data: null })
	]);
	const audios = (r.audio_guides ?? []) as {
		lang: string;
		storage_path: string;
		transcript: string | null;
	}[];
	const a = agg.data as {
		total: number | null;
		winner_level: number | null;
		winner_pct: number | null;
		is_new: boolean | null;
	} | null;
	const td = tide.data as { extremes: unknown; provider: keyof typeof TIDE_ATTRIBUTION } | null;
	return {
		slug: r.slug,
		translations,
		hero: photos.get(id)?.[0],
		coords: lonLat(r.location),
		monsoon: (r.monsoon_status ?? null) as QrData['safety']['monsoon'],
		monsoonReason: (r.monsoon_reason ?? null) as string | null,
		tideDependent: Boolean(r.is_tide_dependent),
		tide: td
			? {
					extremes: td.extremes as NonNullable<QrData['safety']['tide']>['extremes'],
					attribution: TIDE_ATTRIBUTION[td.provider]
				}
			: null,
		audio: audios.find((x) => x.lang === lang) ?? audios.find((x) => x.lang === 'en') ?? null,
		menu: ((r.menu as { items?: string[] } | null)?.items ?? []).filter(Boolean),
		verdict:
			kind === 'place'
				? null
				: {
						level: a?.winner_level ?? null,
						pct: a?.winner_pct != null ? Number(a.winner_pct) : null,
						total: a?.total ?? 0,
						isNew: a?.is_new ?? true
					},
		reviews: ((reviews.data ?? []) as { text: string; created_at: string }[]).map((x) => ({
			text: x.text,
			date: x.created_at
		}))
	};
}

/** SHA-256 hex of the anonymous scan cookie (DECISIONS P6-4); the raw id never reaches the DB. */
export async function sessionHash(id: string) {
	const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id));
	return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
