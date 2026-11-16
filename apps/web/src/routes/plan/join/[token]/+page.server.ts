import { error, redirect } from '@sveltejs/kit';
import { session } from '#lib/server/auth.ts';
import type { Actions, PageServerLoad } from './$types';

// /plan/join/:token — edit / view invite link (P11 §6). Hardening 2026-11 (SEC-20): opening the link only shows
// "Join this trip?"; joining is the POST below, so link previews, chat apps and prefetching never add anyone.
// Signed out → sign in (or the guest step) and back here.
const TOKEN = /^[\w-]{8,100}$/;

export const load: PageServerLoad = async (event) => {
	await session(event);
	if (!TOKEN.test(event.params.token)) error(404, 'invite not valid');
	const { data } = await event.locals.supabase
		.rpc('trip_invite_preview', { _token: event.params.token })
		.maybeSingle();
	if (!data) error(404, 'invite not valid');
	return { title: data.title, role: data.role };
};

export const actions: Actions = {
	join: async (event) => {
		await session(event);
		if (!TOKEN.test(event.params.token)) error(404, 'invite not valid');
		const { data: trip } = await event.locals.supabase.rpc('redeem_trip_invite', {
			_token: event.params.token
		});
		if (!trip) error(404, 'invite not valid');
		redirect(303, `/plan/${trip}`);
	}
};
