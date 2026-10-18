import { json } from '@sveltejs/kit';
import { getLocale } from '#lib/paraglide/runtime.js';
import type { Lang } from '#lib/server/listings.ts';
import { listPacks } from '#lib/server/packs.ts';
import type { RequestHandler } from './$types';

// GET /api/packs — downloadable taluka packs with size + version (FRONTEND §9).
export const GET: RequestHandler = async ({ locals }) =>
	json(await listPacks(locals.supabase, getLocale() as Lang), {
		headers: { 'Cache-Control': 'public, max-age=600' }
	});
