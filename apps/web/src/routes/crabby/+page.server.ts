import { getLocale } from '#lib/paraglide/runtime.js';
import type { Lang } from '#lib/server/listings.ts';
import { spotContext } from '#lib/server/ai/spot.ts';
import type { PageServerLoad } from './$types';

// /crabby?spot=<QR code> (P12 step F, product plan 10.3): Crabby preloaded with the place the visitor just
// scanned. Visitors who aren't signed in get that place's facts as a static FAQ (chat needs login).
export const load: PageServerLoad = async ({ locals, url }) => {
	const code = url.searchParams.get('spot')?.toUpperCase() ?? '';
	const spot = code ? await spotContext(locals.supabase, code, getLocale() as Lang) : null;
	return { spot, signedIn: !!(await locals.getUser()) };
};
