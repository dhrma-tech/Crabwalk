import { json } from '@sveltejs/kit';
import { session } from '#lib/server/auth.ts';
import type { RequestHandler } from './$types';

// GET /api/trips — the signed-in visitor's own trips that can still change (not completed), newest first.
// Feeds the "Add to trip" sheet on listing pages (DECISIONS T-4 / T-47). Private: never cached.
export const GET: RequestHandler = async (event) => {
	const { user } = await session(event);
	const { data } = await event.locals.supabase
		.from('trips')
		.select('id, title, days, start_date')
		.eq('owner_id', user.id)
		.neq('status', 'completed')
		.order('created_at', { ascending: false })
		.limit(20);
	return json(data ?? [], { headers: { 'Cache-Control': 'private, no-store' } });
};
