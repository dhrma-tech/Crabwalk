import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { getLocale } from '#lib/paraglide/runtime.js';
import { session } from '#lib/server/auth.ts';
import type { Lang } from '#lib/server/listings.ts';
import { withListings } from '#lib/server/requests.ts';
import type { Actions, PageServerLoad } from './$types';

// My availability requests (P12 step I, 10.2): the owner's (or our team's) reply, a counter offer, and my
// decision. Accepting shares my phone with the owner — only then (DB guard). No booking or payment here.
export const load: PageServerLoad = async (event) => {
	const { user } = await session(event);
	const db = event.locals.supabase;
	const { data } = await db
		.from('stay_requests')
		.select('*')
		.eq('user_id', user.id)
		.order('created_at', { ascending: false })
		.limit(50);
	return { requests: await withListings(db, data ?? [], getLocale() as Lang) };
};

const id = z.uuid();
const phone = z
	.string()
	.trim()
	.regex(/^\+?[0-9 ]{8,16}$/);
async function set(event: Parameters<Actions[string]>[0], fields: Record<string, unknown>) {
	const { user } = await session(event);
	const f = await event.request.formData();
	const r = id.safeParse(f.get('id'));
	if (!r.success) return fail(400);
	const { error } = await event.locals.supabase
		.from('stay_requests')
		.update(fields as never)
		.eq('id', r.data)
		.eq('user_id', user.id);
	if (error) return fail(403);
	return { done: r.data };
}

export const actions: Actions = {
	accept: async (event) => {
		const f = await event.request.clone().formData();
		const p = phone.safeParse(f.get('phone'));
		if (!p.success) return fail(400, { phone: true });
		return set(event, { status: 'accepted', contact_phone: p.data });
	},
	decline: (event) => set(event, { status: 'declined' }),
	cancel: (event) => set(event, { status: 'cancelled' })
};
