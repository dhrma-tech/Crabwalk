import { fail } from '@sveltejs/kit';
import { getLocale } from '#lib/paraglide/runtime.js';
import { session } from '#lib/server/auth.ts';
import type { Lang } from '#lib/server/listings.ts';
import { replyRequest, withListings } from '#lib/server/requests.ts';
import type { Actions, PageServerLoad } from './$types';

// Availability requests for my listings (P12 step I, 10.2): answer in one tap or counter once. RLS shows an owner
// only requests for listings they own.
export const load: PageServerLoad = async (event) => {
	const { user } = await session(event);
	const db = event.locals.supabase;
	const { data } = await db
		.from('stay_requests')
		.select('*')
		.neq('user_id', user.id)
		.not('status', 'in', '(cancelled,declined)')
		.order('created_at', { ascending: false })
		.limit(50);
	return { requests: await withListings(db, data ?? [], getLocale() as Lang) };
};

export const actions: Actions = {
	reply: async (event) => {
		await session(event);
		if (!(await replyRequest(event.locals.supabase, await event.request.formData())))
			return fail(403);
	}
};
