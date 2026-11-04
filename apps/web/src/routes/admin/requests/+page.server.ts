import { fail } from '@sveltejs/kit';
import { getLocale } from '#lib/paraglide/runtime.js';
import { requireStaff } from '#lib/server/auth.ts';
import type { Lang } from '#lib/server/listings.ts';
import { relayLink, replyRequest, withListings } from '#lib/server/requests.ts';
import type { Actions, PageServerLoad } from './$types';

// Requests for listings nobody has claimed yet (P12 step I, 10.2): our team sends the owner a prefilled WhatsApp
// message (a manual tap — no paid API), marks it relayed, and enters the owner's answer. RLS shows the team only
// unclaimed listings' requests.
export const load: PageServerLoad = async (event) => {
	const { user } = await requireStaff(event);
	const db = event.locals.supabase;
	const lang = getLocale() as Lang;
	const { data } = await db
		.from('stay_requests')
		.select('*')
		.neq('user_id', user.id)
		.in('status', ['sent', 'relayed', 'available'])
		.order('created_at')
		.limit(100);
	const rows = await withListings(db, data ?? [], lang);
	return { requests: rows.map((r) => ({ ...r, relay: relayLink(r.whatsapp, r, r.name, lang) })) };
};

export const actions: Actions = {
	reply: async (event) => {
		await requireStaff(event);
		if (!(await replyRequest(event.locals.supabase, await event.request.formData())))
			return fail(403);
	}
};
