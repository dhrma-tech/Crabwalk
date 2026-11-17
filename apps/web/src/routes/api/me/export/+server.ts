import { session } from '#lib/server/auth.ts';
import { exportRows } from '#lib/server/account.ts';
import type { RequestHandler } from './$types';

// GET /api/me/export (SEC-15): everything the signed-in user has stored, as a JSON download. Read with their own
// session, so RLS limits it to their rows. Rate rule `me-export`.
export const GET: RequestHandler = async (event) => {
	const { user } = await session(event);
	const data = await exportRows(event.locals.supabase, user.id);
	const day = new Date().toISOString().slice(0, 10);
	return new Response(JSON.stringify(data, null, 2), {
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Content-Disposition': `attachment; filename="crabwalk-data-${day}.json"`,
			'Cache-Control': 'private, no-store'
		}
	});
};
