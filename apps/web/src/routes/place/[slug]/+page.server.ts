import { error } from '@sveltejs/kit';
import { getLocale } from '#lib/paraglide/runtime.js';
import { ratingsFor } from '#lib/server/ratings.ts';
import { getPlace, lonLat, names, nearby, photoUrls, tr, type Lang } from '#lib/server/listings.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const p = await getPlace(locals.supabase, params.slug);
	if (!p) error(404, 'not found');
	const lang = getLocale() as Lang;
	const n = names(p.place_translations);
	const coords = lonLat(p.location);
	const t = (f: 'short_story' | 'history' | 'significance' | 'dos' | 'donts' | 'safety_text') =>
		tr(p.place_translations, lang, f);
	const wd = new Date(Date.now() + 5.5 * 3600e3).getUTCDay();
	return {
		place: {
			id: p.id,
			slug: p.slug,
			category: p.category,
			names: n,
			isGem: p.is_hidden_gem,
			tideDependent: p.is_tide_dependent,
			tideStation: p.tide_station_id,
			monsoon: p.monsoon_status,
			monsoonReason: p.monsoon_reason,
			fee: p.entry_fee_text,
			bestTime: p.best_time_text,
			howToReach: p.how_to_reach_text,
			station: p.nearest_station_text,
			bus: p.nearest_bus_stop_text,
			foodDelivery: (p.food_delivery ?? {}) as Record<string, boolean>,
			lastVerified: p.last_verified_at,
			hours: p.place_hours,
			crowdToday: p.crowd_typical.find((c) => c.weekday === wd)?.level ?? null,
			text: {
				story: t('short_story'),
				history: t('history'),
				significance: t('significance'),
				dos: t('dos'),
				donts: t('donts'),
				safety: t('safety_text')
			},
			audio:
				p.audio_guides.find((a) => a.lang === lang) ??
				p.audio_guides.find((a) => a.lang === 'en') ??
				null,
			photos: p.photos.map((ph) => photoUrls(ph, n[lang] || n.en)),
			coords
		},
		ratings: await ratingsFor(locals.supabase, 'place', p.id, (await locals.getUser())?.id ?? null),
		nearby: coords
			? await nearby(locals.supabase, coords[0], coords[1])
			: { listings: [], utilities: [] }
	};
};
