import {
	listDishes,
	listEateries,
	listPlaces,
	listStays,
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
import { byMonsoon, MONSOON_COOKIE, monsoonMode } from '#lib/prefs.ts';
import type { PageServerLoad } from './$types';

const withPhotoFirst = <T extends { photo: unknown }>(rows: T[]) =>
	[...rows].sort((a, b) => Number(!!b.photo) - Number(!!a.photo));

// Discover (FRONTEND §7.1, Report 2 §9.1). ?category= filters the place grid (own title, canonical, meta: Report 1 §3.11).
export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	const lang = getLocale() as Lang;
	// T3-03: in monsoon mode place lists show closures first, then risky places, with a badge. Nothing is hidden.
	const monsoon = monsoonMode(cookies.get(MONSOON_COOKIE));
	const order = <T extends { monsoon: 'open' | 'risky' | 'closed' }>(rows: T[]) =>
		monsoon ? byMonsoon(rows) : rows;
	const category = readFilter(placeFilter, url.searchParams)?.category;
	const [places, gems, dishes, season, itineraries, today, stays, eateries] = await Promise.all([
		listPlaces(locals.supabase, { category }),
		category ? Promise.resolve([]) : listPlaces(locals.supabase, { hiddenGem: true, limit: 10 }),
		category ? Promise.resolve([]) : listDishes(locals.supabase),
		seasonStrip(locals.supabase),
		category ? Promise.resolve([]) : listItineraries(locals.supabase, lang, 6),
		category ? Promise.resolve(null) : todayOnCoast(locals.supabase),
		category ? Promise.resolve([]) : listStays(locals.supabase),
		category ? Promise.resolve([]) : listEateries(locals.supabase)
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
			monsoon: p.monsoon_status,
			agg: aggs.get(p.id) ?? null,
			coords: lonLat(p.location),
			photo: p.hero ? photoUrls(p.hero, n[lang] || n.en) : null
		};
	};
	return {
		category: category ?? null,
		monsoon,
		places: order(places.map(card)),
		gems: order(gems.map(card)),
		// Discover rows (user, 2026-11-11): Places → Stays → Food after Explore; photographed listings first.
		placeRow: category ? [] : order(withPhotoFirst(places.map(card))).slice(0, 12),
		stays: withPhotoFirst(
			stays.map((s) => {
				const n = names(s.stay_translations);
				return {
					slug: s.slug,
					names: n,
					priceMin: s.price_min,
					priceMax: s.price_max,
					priceSource: s.price_source,
					serviceStyle: s.service_style,
					photo: s.hero ? photoUrls(s.hero, n[lang] || n.en) : null
				};
			})
		).slice(0, 10),
		eateries: withPhotoFirst(
			eateries.map((e) => {
				const n = names(e.eatery_translations);
				const sig = e.eatery_dishes.find((d) => d.is_signature)?.dishes;
				const flags = (e.diet_flags ?? {}) as Record<string, boolean>;
				return {
					slug: e.slug,
					name: n[lang] || n.en,
					signature: sig ? tr(sig.dish_translations, lang) : null,
					priceForTwo: e.price_for_two,
					veg: !!flags.veg,
					nonVeg: !!flags.non_veg,
					photo: e.hero ? photoUrls(e.hero, n[lang] || n.en) : null
				};
			})
		).slice(0, 10),
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
