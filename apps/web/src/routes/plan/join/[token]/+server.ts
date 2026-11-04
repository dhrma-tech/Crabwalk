import { error, redirect } from '@sveltejs/kit';
import { session } from '#lib/server/auth.ts';
import type { RequestHandler } from './$types';

// GET /plan/join/:token — edit / view invite link (P11 §6): signed out → login and back; signed in → join with
// that role (or keep a higher one) and open the trip.
export const GET: RequestHandler = async (event) => {
	await session(event);
	const { data: trip } = await event.locals.supabase.rpc('redeem_trip_invite', {
		_token: event.params.token
	});
	if (!trip) error(404, 'invite not valid');
	redirect(303, `/plan/${trip}`);
};
