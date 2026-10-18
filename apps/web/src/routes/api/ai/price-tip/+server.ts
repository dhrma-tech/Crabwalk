import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { getLocale } from '#lib/paraglide/runtime.js';
import { session } from '#lib/server/auth.ts';
import { priceTip } from '#lib/server/ai/assist.ts';
import { getStay, type Lang } from '#lib/server/listings.ts';
import { priceRows } from '#lib/server/prices.ts';
import type { RequestHandler } from './$types';

// POST /api/ai/price-tip {slug} — one-line comparison of the stay's own price rows (PLAN P8 task 11).
export const POST: RequestHandler = async (event) => {
	await session(event);
	const b = z
		.object({ slug: z.string().min(1).max(200) })
		.safeParse(await event.request.json().catch(() => null));
	if (!b.success) error(400, 'bad request');
	const s = await getStay(event.locals.supabase, b.data.slug);
	if (!s) error(404, 'not found');
	try {
		const r = await priceTip(event.locals.supabase, getLocale() as Lang, await priceRows(s));
		return json(r, { status: r.kind === 'limit' ? 429 : 200 });
	} catch {
		error(503, 'unavailable');
	}
};
