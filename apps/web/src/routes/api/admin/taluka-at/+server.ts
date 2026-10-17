import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { requireStaff } from '#lib/server/auth.ts';
import type { RequestHandler } from './$types';

const q = z.object({
	lon: z.coerce.number().min(-180).max(180),
	lat: z.coerce.number().min(-90).max(90)
});

// GPS → taluka for the field form (null when boundaries aren't loaded).
export const GET: RequestHandler = async (event) => {
	await requireStaff(event);
	const p = q.safeParse(Object.fromEntries(event.url.searchParams));
	if (!p.success) return json({ taluka_id: null });
	const { data } = await event.locals.supabase.rpc('taluka_at', p.data);
	return json({ taluka_id: data ?? null });
};
