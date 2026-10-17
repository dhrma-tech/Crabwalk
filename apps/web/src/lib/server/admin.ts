// Write side for the verifier field form (POST /api/admin/{places,stays,eateries}) — BACKEND §14.
// Runs with the signed-in user's client: RLS (staff in taluka) and guard_publish do the authorisation.
// The client supplies the listing id so offline-queue retries are idempotent.
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Constants, type Database } from '#lib/db.types.ts';

type DB = SupabaseClient<Database>;
const E = Constants.public.Enums;
const text = z
	.string()
	.trim()
	.max(1000)
	.optional()
	.transform((s) => s || null);
const phone = z
	.string()
	.trim()
	.regex(/^\+?[\d\s-]{6,20}$/)
	.optional()
	.or(z.literal(''))
	.transform((s) => s || null);
const time = z.string().regex(/^\d{2}:\d{2}$/);
const hours = z
	.array(
		z.object({
			weekday: z.number().int().min(0).max(6),
			opens: time.nullable(),
			closes: time.nullable(),
			hours_unknown: z.boolean()
		})
	)
	.max(7);

export const FOOD_APPS = ['swiggy', 'zomato', 'eatsure', 'magicpin'] as const;
export const OPERATORS = ['Jio', 'Airtel', 'Vi', 'BSNL'] as const;

const base = z.object({
	id: z.uuid(),
	name_en: z.string().trim().min(2).max(120),
	name_mr: z.string().trim().max(120).optional(),
	lon: z.number().min(-180).max(180),
	lat: z.number().min(-90).max(90),
	taluka_id: z.uuid()
});

export const placeInput = base.extend({
	category: z.enum(E.place_category),
	entry_fee_text: text,
	best_time_text: text,
	how_to_reach_text: text,
	nearest_station_text: text,
	nearest_bus_stop_text: text,
	is_hidden_gem: z.boolean(),
	is_tide_dependent: z.boolean(),
	monsoon_status: z.enum(E.monsoon_status),
	monsoon_reason: text,
	food_delivery: z.partialRecord(z.enum(FOOD_APPS), z.boolean()),
	hours,
	crowd: z
		.array(z.object({ weekday: z.number().int().min(0).max(6), level: z.enum(E.crowd_level) }))
		.max(7),
	notes: text
});

export const stayInput = base
	.extend({
		vibe_tags: z
			.array(
				z.enum([
					'traditional_konkani_home',
					'family',
					'luxury',
					'business',
					'backpacker',
					'couple_friendly',
					'pet_friendly',
					'beachfront',
					'orchard_stay'
				])
			)
			.max(9),
		service_style: z.enum(E.service_style).nullable(),
		amenities: z.partialRecord(
			z.enum(['ac', 'hot_water', 'wifi', 'parking', 'power_backup']),
			z.boolean()
		),
		network_strength: z.partialRecord(z.enum(OPERATORS), z.enum(['none', 'weak', 'good'])),
		food_at_stay: z.partialRecord(
			z.enum(['veg', 'non_veg', 'malvani', 'jain', 'homemade_included']),
			z.boolean()
		),
		price_min: z.number().int().min(0).nullable(),
		price_max: z.number().int().min(0).nullable(),
		phone,
		whatsapp: phone
	})
	.refine(
		(s) => s.price_min == null || s.price_max == null || s.price_max >= s.price_min,
		'price range'
	);

export const eateryInput = base.extend({
	authenticity: z.enum(E.eatery_authenticity).nullable(),
	price_for_two: z.number().int().min(0).nullable(),
	diet_flags: z.partialRecord(z.enum(['veg', 'non_veg', 'jain']), z.boolean()),
	service_style: z.enum(E.service_style).nullable(),
	food_apps: z.partialRecord(
		z.enum(FOOD_APPS),
		z.object({
			available: z.boolean(),
			link: z
				.url({ protocol: /^https$/ })
				.optional()
				.or(z.literal(''))
		})
	),
	hours,
	dish_ids: z.array(z.uuid()).max(10),
	phone,
	whatsapp: phone
});

const slugify = (s: string) =>
	s
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^\w\s-]/g, '')
		.trim()
		.replace(/[\s_]+/g, '-')
		.slice(0, 60) || 'listing';
const point = (lon: number, lat: number) => `SRID=4326;POINT(${lon} ${lat})`;
const hm = (t: string | null) => (t ? `${t}:00` : null);

/** Returns the existing row when the id was already submitted (queue retry). */
async function existing(db: DB, table: 'places' | 'stays' | 'eateries', id: string) {
	const { data } = await db.from(table).select('id, slug').eq('id', id).maybeSingle();
	return data;
}

async function names(
	db: DB,
	table: 'place_translations' | 'stay_translations' | 'eatery_translations',
	fk: string,
	id: string,
	en: string,
	mr?: string
) {
	const rows = [
		{ [fk]: id, lang: 'en', name: en },
		...(mr ? [{ [fk]: id, lang: 'mr', name: mr }] : [])
	];
	const { error } = await db.from(table).insert(rows as never);
	if (error) throw error;
}

export async function createPlace(db: DB, userId: string, p: z.infer<typeof placeInput>) {
	const dup = await existing(db, 'places', p.id);
	if (dup) return dup;
	const slug = `${slugify(p.name_en)}-${p.id.slice(0, 4)}`;
	const { error } = await db.from('places').insert({
		id: p.id,
		slug,
		category: p.category,
		taluka_id: p.taluka_id,
		location: point(p.lon, p.lat),
		entry_fee_text: p.entry_fee_text,
		best_time_text: p.best_time_text,
		how_to_reach_text: p.how_to_reach_text,
		nearest_station_text: p.nearest_station_text,
		nearest_bus_stop_text: p.nearest_bus_stop_text,
		is_hidden_gem: p.is_hidden_gem,
		is_tide_dependent: p.is_tide_dependent,
		monsoon_status: p.monsoon_status,
		monsoon_reason: p.monsoon_reason,
		food_delivery: p.food_delivery,
		status: 'in_review',
		last_verified_at: new Date().toISOString()
	});
	if (error) throw error;
	await names(db, 'place_translations', 'place_id', p.id, p.name_en, p.name_mr);
	if (p.hours.length) {
		const { error: e } = await db.from('place_hours').insert(
			p.hours.map((h) => ({
				place_id: p.id,
				weekday: h.weekday,
				opens: hm(h.opens),
				closes: hm(h.closes),
				hours_unknown: h.hours_unknown
			}))
		);
		if (e) throw e;
	}
	if (p.crowd.length) {
		const { error: e } = await db
			.from('crowd_typical')
			.insert(p.crowd.map((c) => ({ place_id: p.id, weekday: c.weekday, level: c.level })));
		if (e) throw e;
	}
	if (p.notes) {
		const { error: e } = await db
			.from('verifier_notes')
			.insert({ place_id: p.id, author_id: userId, notes: p.notes });
		if (e) throw e;
	}
	return { id: p.id, slug };
}

export async function createStay(db: DB, s: z.infer<typeof stayInput>) {
	const dup = await existing(db, 'stays', s.id);
	if (dup) return dup;
	const slug = `${slugify(s.name_en)}-${s.id.slice(0, 4)}`;
	const { error } = await db.from('stays').insert({
		id: s.id,
		slug,
		taluka_id: s.taluka_id,
		location: point(s.lon, s.lat),
		vibe_tags: s.vibe_tags,
		service_style: s.service_style,
		amenities: s.amenities,
		network_strength: s.network_strength,
		food_at_stay: s.food_at_stay,
		price_min: s.price_min,
		price_max: s.price_max,
		price_source: s.price_min != null ? 'owner' : null,
		phone: s.phone,
		whatsapp: s.whatsapp,
		is_verified: true,
		status: 'in_review',
		last_verified_at: new Date().toISOString()
	});
	if (error) throw error;
	await names(db, 'stay_translations', 'stay_id', s.id, s.name_en, s.name_mr);
	return { id: s.id, slug };
}

export async function createEatery(db: DB, e: z.infer<typeof eateryInput>) {
	const dup = await existing(db, 'eateries', e.id);
	if (dup) return dup;
	const slug = `${slugify(e.name_en)}-${e.id.slice(0, 4)}`;
	const apps = Object.fromEntries(
		Object.entries(e.food_apps).map(([k, v]) => [
			k,
			{ available: v.available, link: v.link || null }
		])
	);
	const { error } = await db.from('eateries').insert({
		id: e.id,
		slug,
		taluka_id: e.taluka_id,
		location: point(e.lon, e.lat),
		authenticity: e.authenticity,
		price_for_two: e.price_for_two,
		diet_flags: e.diet_flags,
		service_style: e.service_style,
		food_apps: apps,
		phone: e.phone,
		whatsapp: e.whatsapp,
		is_verified: true,
		status: 'in_review',
		last_verified_at: new Date().toISOString()
	});
	if (error) throw error;
	await names(db, 'eatery_translations', 'eatery_id', e.id, e.name_en, e.name_mr);
	if (e.hours.length) {
		const { error: x } = await db.from('eatery_hours').insert(
			e.hours.map((h) => ({
				eatery_id: e.id,
				weekday: h.weekday,
				opens: hm(h.opens),
				closes: hm(h.closes),
				hours_unknown: h.hours_unknown
			}))
		);
		if (x) throw x;
	}
	if (e.dish_ids.length) {
		const { error: x } = await db
			.from('eatery_dishes')
			.insert(e.dish_ids.map((d) => ({ eatery_id: e.id, dish_id: d, is_signature: true })));
		if (x) throw x;
	}
	return { id: e.id, slug };
}
