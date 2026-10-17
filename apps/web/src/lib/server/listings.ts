// Read side for listing pages and /api/* (BACKEND §14). RLS decides visibility; pages add status = 'published'.
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from '$app/env/public';
import type { Database } from '#lib/db.types.ts';

type DB = SupabaseClient<Database>;
export type Lang = 'en' | 'hi' | 'mr';
type Tr = { lang: string; name?: string | null } & Record<string, unknown>;

/** Field in the UI language, falling back to English (content comes from *_translations — FRONTEND §10). */
export const tr = <T extends Tr>(
	rows: T[] | null | undefined,
	lang: Lang,
	field: keyof T = 'name'
) =>
	((rows?.find((r) => r.lang === lang)?.[field] ?? rows?.find((r) => r.lang === 'en')?.[field]) as
		string | null) ?? null;

export const names = (rows: Tr[] | null | undefined) => ({
	en: tr(rows, 'en') ?? '',
	hi: rows?.find((r) => r.lang === 'hi')?.name ?? null,
	mr: rows?.find((r) => r.lang === 'mr')?.name ?? null
});

// Photos are stored as <path>-<width>.webp (client-side resize, DECISIONS P4-2).
export const PHOTO_WIDTHS = [480, 960, 1600] as const;
export function photoUrls(
	p: { storage_path: string; lqip: string | null; width: number | null },
	alt: string
) {
	const base = `${SUPABASE_URL}/storage/v1/object/public/photos/${p.storage_path}`;
	const widths = PHOTO_WIDTHS.filter((w) => !p.width || w <= Math.max(p.width, PHOTO_WIDTHS[0]));
	return {
		src: `${base}-${widths.at(-1)}.webp`,
		srcset: widths.map((w) => `${base}-${w}.webp ${w}w`).join(', '),
		lqip: p.lqip ?? undefined,
		alt
	};
}

type EntityType = Database['public']['Enums']['listing_type'];
export async function photosFor(db: DB, type: EntityType, ids: string[]) {
	if (!ids.length) return new Map<string, Database['public']['Tables']['photos']['Row'][]>();
	const { data } = await db
		.from('photos')
		.select('*')
		.eq('entity_type', type)
		.in('entity_id', ids)
		.order('is_hero', { ascending: false })
		.order('created_at');
	const out = new Map<string, NonNullable<typeof data>>();
	for (const p of data ?? [])
		(out.get(p.entity_id) ?? out.set(p.entity_id, []).get(p.entity_id)!).push(p);
	return out;
}

const PLACE_TR = 'lang, name, short_story, history, significance, dos, donts, safety_text';

export async function listPlaces(
	db: DB,
	f: { category?: string; hiddenGem?: boolean; limit?: number } = {}
) {
	let q = db
		.from('places')
		.select(
			`id, slug, category, is_hidden_gem, is_tide_dependent, monsoon_status, monsoon_reason, last_verified_at, location, place_translations(lang, name)`
		)
		.eq('status', 'published')
		.order('last_verified_at', { ascending: false, nullsFirst: false })
		.limit(f.limit ?? 60);
	if (f.category) q = q.eq('category', f.category as Database['public']['Enums']['place_category']);
	if (f.hiddenGem) q = q.eq('is_hidden_gem', true);
	const { data, error } = await q;
	if (error) throw error;
	const photos = await photosFor(
		db,
		'place',
		data.map((p) => p.id)
	);
	return data.map((p) => ({ ...p, hero: photos.get(p.id)?.[0] ?? null }));
}

export async function getPlace(db: DB, slug: string) {
	const { data: p } = await db
		.from('places')
		.select(
			`*, place_translations(${PLACE_TR}), place_hours(*), place_seasonal(*), crowd_typical(*), audio_guides(*)`
		)
		.eq('slug', slug)
		.eq('status', 'published')
		.maybeSingle();
	if (!p) return null;
	const photos = (await photosFor(db, 'place', [p.id])).get(p.id) ?? [];
	return { ...p, photos };
}

export async function listStays(
	db: DB,
	f: { vibe?: string; style?: string; maxPrice?: number; amenity?: string } = {}
) {
	let q = db
		.from('stays')
		.select(
			'id, slug, vibe_tags, service_style, amenities, price_min, price_max, price_source, is_verified, last_verified_at, stay_translations(lang, name)'
		)
		.eq('status', 'published')
		.limit(60);
	if (f.vibe) q = q.contains('vibe_tags', [f.vibe]);
	if (f.style) q = q.eq('service_style', f.style as Database['public']['Enums']['service_style']);
	if (f.maxPrice) q = q.lte('price_min', f.maxPrice);
	if (f.amenity) q = q.contains('amenities', { [f.amenity]: true });
	const { data, error } = await q;
	if (error) throw error;
	const photos = await photosFor(
		db,
		'stay',
		data.map((s) => s.id)
	);
	return data.map((s) => ({ ...s, hero: photos.get(s.id)?.[0] ?? null }));
}

export async function getStay(db: DB, slug: string) {
	const { data: s } = await db
		.from('stays')
		.select('*, stay_translations(lang, name, description), stay_offers(*)')
		.eq('slug', slug)
		.eq('status', 'published')
		.maybeSingle();
	if (!s) return null;
	const photos = (await photosFor(db, 'stay', [s.id])).get(s.id) ?? [];
	return { ...s, photos };
}

export async function listEateries(
	db: DB,
	f: { diet?: string; authenticity?: string; maxPrice?: number } = {}
) {
	let q = db
		.from('eateries')
		.select(
			'id, slug, authenticity, price_for_two, diet_flags, last_verified_at, eatery_translations(lang, name), eatery_dishes(is_signature, dishes(slug, dish_translations(lang, name)))'
		)
		.eq('status', 'published')
		.limit(60);
	if (f.diet) q = q.contains('diet_flags', { [f.diet]: true });
	if (f.authenticity)
		q = q.eq('authenticity', f.authenticity as Database['public']['Enums']['eatery_authenticity']);
	if (f.maxPrice) q = q.lte('price_for_two', f.maxPrice);
	const { data, error } = await q;
	if (error) throw error;
	const photos = await photosFor(
		db,
		'eatery',
		data.map((e) => e.id)
	);
	return data.map((e) => ({ ...e, hero: photos.get(e.id)?.[0] ?? null }));
}

export async function getEatery(db: DB, slug: string) {
	const { data: e } = await db
		.from('eateries')
		.select(
			'*, eatery_translations(lang, name, description), eatery_hours(*), eatery_dishes(is_signature, is_best_for, dishes(slug, dish_translations(lang, name)))'
		)
		.eq('slug', slug)
		.eq('status', 'published')
		.maybeSingle();
	if (!e) return null;
	const photos = (await photosFor(db, 'eatery', [e.id])).get(e.id) ?? [];
	return { ...e, photos };
}

export async function listDishes(db: DB) {
	const { data, error } = await db
		.from('dishes')
		.select('id, slug, dish_translations(lang, name, what_it_is)')
		.order('slug');
	if (error) throw error;
	const photos = await photosFor(
		db,
		'dish',
		data.map((d) => d.id)
	);
	return data
		.filter((d) => d.dish_translations.length)
		.map((d) => ({ ...d, hero: photos.get(d.id)?.[0] ?? null }));
}

export async function getDish(db: DB, slug: string) {
	const { data: d } = await db
		.from('dishes')
		.select(
			'id, slug, dish_translations(lang, name, what_it_is, story), eatery_dishes(is_signature, is_best_for, eateries(slug, status, price_for_two, eatery_translations(lang, name)))'
		)
		.eq('slug', slug)
		.maybeSingle();
	if (!d || !d.dish_translations.length) return null;
	const photos = (await photosFor(db, 'dish', [d.id])).get(d.id) ?? [];
	const eateries = d.eatery_dishes.filter((x) => x.eateries?.status === 'published');
	return { ...d, eatery_dishes: eateries, photos };
}

/** Season strip: place seasons active this month + current/near events (FRONTEND §7.1). */
export async function seasonStrip(db: DB) {
	const month = Number(
		new Intl.DateTimeFormat('en-IN', { month: 'numeric', timeZone: 'Asia/Kolkata' }).format(
			new Date()
		)
	);
	const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
	const [{ data: seasons }, { data: events }] = await Promise.all([
		db.from('place_seasonal').select('season, from_month, to_month'),
		db
			.from('events_calendar')
			.select('name_en, name_hi, name_mr, type, from_date, to_date')
			.lte('from_date', today)
			.gte('to_date', today)
			.limit(5)
	]);
	const inSeason = (s: { from_month: number; to_month: number }) =>
		s.from_month <= s.to_month
			? month >= s.from_month && month <= s.to_month
			: month >= s.from_month || month <= s.to_month;
	return {
		seasons: [...new Set((seasons ?? []).filter(inSeason).map((s) => s.season))],
		events: events ?? []
	};
}

/** Published stays/food + utilities within ~5 km (uses the P3 map RPCs). */
export async function nearby(db: DB, lon: number, lat: number) {
	const d = 0.05;
	const box = { min_lon: lon - d, min_lat: lat - d, max_lon: lon + d, max_lat: lat + d };
	const [{ data: pins }, { data: utils }] = await Promise.all([
		db.rpc('map_pins', { ...box, kinds: ['stay', 'eatery'] }),
		db.rpc('map_utilities', {
			...box,
			types: ['hospital', 'fuel', 'atm', 'pharmacy', 'toilet', 'police', 'bus_stand']
		})
	]);
	const km = (x: { lon: number; lat: number }) =>
		Math.hypot((x.lon - lon) * 111.32 * Math.cos((lat * Math.PI) / 180), (x.lat - lat) * 110.57);
	const sort = <T extends { lon: number; lat: number }>(a: T[]) =>
		a.map((x) => ({ ...x, km: km(x) })).sort((p, q) => p.km - q.km);
	return { listings: sort(pins ?? []).slice(0, 6), utilities: sort(utils ?? []).slice(0, 8) };
}

/** Point (EWKB/GeoJSON from PostgREST) → [lon, lat]. */
export function lonLat(location: unknown): [number, number] | null {
	if (location && typeof location === 'object' && 'coordinates' in location)
		return (location as { coordinates: [number, number] }).coordinates;
	if (typeof location === 'string' && /^0101000020E6100000/i.test(location)) {
		const buf = Uint8Array.from(location.match(/../g)!.map((h) => parseInt(h, 16)));
		const v = new DataView(buf.buffer);
		return [v.getFloat64(9, true), v.getFloat64(17, true)];
	}
	return null;
}
