import { json } from '@sveltejs/kit';
import { listDishes } from '#lib/server/listings.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) =>
	json(await listDishes(locals.supabase), { headers: { 'Cache-Control': 'public, max-age=300' } });
