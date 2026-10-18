import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { packData } from '#lib/server/packs.ts';
import type { RequestHandler } from './$types';

// GET /api/packs/:taluka/data — listing + utility data stored with a downloaded pack.
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!z.uuid().safeParse(params.id).success) error(404, 'not found');
	return json(await packData(locals.supabase, params.id), {
		headers: { 'Cache-Control': 'public, max-age=3600' }
	});
};
