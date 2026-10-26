import {
	listDishes,
	listPlaces,
	lonLat,
	names,
	photoUrls,
	seasonStrip,
	todayOnCoast,
	tr,
	type Lang
} from '#lib/server/listings.ts';
import { placeFilter, readFilter } from '#lib/server/filters.ts';
import { cardAggs } from '#lib/server/ratings.ts';
import { listItineraries } from '#lib/server/planner/itineraries.ts';
import { getLocale } from '#lib/paraglide/runtime.js';
import type { PageServerLoad } from './$types';

// Discover (FRONTEND §7.1, Report 2 §9.1). ?category= filters the place grid (own title, canonical, meta: Report 1 §3.11).
export const load: PageServerLoad = async ({ locals, url }) => {
	const lang = getLocale() as Lang;
	const category = readFilter(placeFilter, url.searchParams)?.category;
	const [places, gems, dishes, season, itineraries, today] = await Promise.all([
		listPlaces(locals.supabase, { category }),
		category ? Promise.resolve([]) : listPlaces(locals.supabase, { hiddenGem: true, limit: 10 }),
		category ? Promise.resolve([]) : listDishes(locals.supabase),
		seasonStrip(locals.supabase),
		category ? Promise.resolve([]) : listItineraries(locals.supabase, lang, 6),
		category ? Promise.resolve(null) : todayOnCoast(locals.supabase)
	]);
	const aggs = await cardAggs(
		locals.supabase,
		'place',
		[...places, ...gems].map((p) => p.id)
	);
	const card = (p: (typeof places)[number]) => {
		const n = names(p.place_translations);
		return {
			slug: p.slug,
			category: p.category,
			names: n,
			isGem: p.is_hidden_gem,
			agg: aggs.get(p.id) ?? null,
			coords: lonLat(p.location),
			photo: p.hero ? photoUrls(p.hero, n[lang] || n.en) : null
		};
	};
	return {
		category: category ?? null,
		places: places.map(card),
		gems: gems.map(card),
		dishes: dishes.slice(0, 12).map((d) => ({
			slug: d.slug,
			name: tr(d.dish_translations, lang) ?? d.slug,
			photo: d.hero ? photoUrls(d.hero, tr(d.dish_translations, lang) ?? d.slug) : null
		})),
		season,
		itineraries,
		today
	};
};
