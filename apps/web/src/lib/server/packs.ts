// Offline taluka packs (FRONTEND §9, PLAN P9 task 3): PMTiles pack + listing data per taluka.
// Pack files come from the tiles host manifest (same naming as pipelines/tiles), so sizes/versions are real.
import type { SupabaseClient } from '@supabase/supabase-js';
import { PMTILES_BASE_URL } from '$app/env/public';
import type { Database } from '#lib/db.types.ts';
import { lonLat, tr, type Lang } from './listings.ts';

type DB = SupabaseClient<Database>;
const slug = (s: string) =>
	s
		.toLowerCase()
		.replace(/\s*taluka$/, '')
		.replace(/[^a-z]+/g, '-');

export async function listPacks(db: DB, lang: Lang) {
	const base = (PMTILES_BASE_URL ?? '').replace(/\/$/, '');
	const [{ data: talukas }, manifest] = await Promise.all([
		db.from('talukas').select('id, name_en, name_hi, name_mr').order('name_en'),
		base
			? fetch(`${base}/manifest.json`)
					.then((r) =>
						r.ok
							? (r.json() as Promise<{ version: string; files: { path: string; bytes: number }[] }>)
							: null
					)
					.catch(() => null)
			: Promise.resolve(null)
	]);
	return (talukas ?? []).flatMap((t) => {
		const path = `packs/${slug(t.name_en)}.pmtiles`;
		const file = manifest?.files.find((f) => f.path === path);
		if (!file) return [];
		return [
			{
				id: t.id,
				name: (lang === 'hi' ? t.name_hi : lang === 'mr' ? t.name_mr : null) || t.name_en,
				tiles: `${base}/${path}`,
				bytes: file.bytes,
				version: manifest!.version,
				data: `/api/packs/${t.id}/data`
			}
		];
	});
}

/** Listings + safety utilities for one taluka — used offline by the map, emergency card and planner views. */
export async function packData(db: DB, talukaId: string) {
	const [places, stays, eateries, utils] = await Promise.all([
		db
			.from('places')
			.select('slug, category, location, monsoon_status, place_translations(lang, name)')
			.eq('status', 'published')
			.eq('taluka_id', talukaId),
		db
			.from('stays')
			.select('slug, location, price_min, stay_translations(lang, name)')
			.eq('status', 'published')
			.eq('taluka_id', talukaId),
		db
			.from('eateries')
			.select('slug, location, price_for_two, eatery_translations(lang, name)')
			.eq('status', 'published')
			.eq('taluka_id', talukaId),
		db
			.from('utility_pois')
			.select('type, name, phone, location')
			.eq('taluka_id', talukaId)
			.in('type', [
				'hospital',
				'pharmacy',
				'police',
				'fuel',
				'atm',
				'toilet',
				'bus_stand',
				'railway_station'
			])
	]);
	const pt = (l: unknown) => lonLat(l) ?? [0, 0];
	const names = (rows: { lang: string; name?: string | null }[]) => ({
		en: tr(rows, 'en' as Lang),
		hi: tr(rows, 'hi' as Lang),
		mr: tr(rows, 'mr' as Lang)
	});
	return {
		generated_at: new Date().toISOString(),
		places: (places.data ?? []).map((p) => ({
			kind: 'place',
			slug: p.slug,
			category: p.category,
			monsoon: p.monsoon_status,
			names: names(p.place_translations),
			at: pt(p.location)
		})),
		stays: (stays.data ?? []).map((s) => ({
			kind: 'stay',
			slug: s.slug,
			price_min: s.price_min,
			names: names(s.stay_translations),
			at: pt(s.location)
		})),
		eateries: (eateries.data ?? []).map((e) => ({
			kind: 'eatery',
			slug: e.slug,
			price_for_two: e.price_for_two,
			names: names(e.eatery_translations),
			at: pt(e.location)
		})),
		// Hospital phones are public emergency contacts (BACKEND: phone only kept for hospitals).
		utilities: (utils.data ?? []).map((u) => ({
			type: u.type,
			name: u.name,
			phone: u.type === 'hospital' ? u.phone : null,
			at: pt(u.location)
		}))
	};
}
