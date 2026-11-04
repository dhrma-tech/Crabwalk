import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { session } from '#lib/server/auth.ts';
import type { RequestHandler } from './$types';

const TABLE = { place: 'places', stay: 'stays', eatery: 'eateries', dish: 'dishes' } as const;
const body = z.discriminatedUnion('kind', [
	z.object({
		kind: z.literal('view'),
		type: z.enum(['place', 'stay', 'eatery', 'dish']),
		slug: z.string().regex(/^[a-z0-9-]{1,120}$/)
	}),
	z.object({ kind: z.literal('search'), query: z.string().trim().min(2).max(120) })
]);

// POST /api/me/activity — one view or picked search for the profile's activity source (P12 step D). Stored only
// when the user switched that source on (RLS refuses otherwise); answers 204 either way.
export const POST: RequestHandler = async (event) => {
	await session(event);
	const b = body.safeParse(await event.request.json().catch(() => null));
	if (!b.success) error(400, 'bad request');
	const db = event.locals.supabase;
	if (b.data.kind === 'search')
		await db.from('user_activity').insert({ kind: 'search', query: b.data.query });
	else {
		const { data } = await db
			.from(TABLE[b.data.type])
			.select('id')
			.eq('slug', b.data.slug)
			.maybeSingle();
		if (data)
			await db
				.from('user_activity')
				.insert({ kind: 'view', entity_type: b.data.type, entity_id: data.id });
	}
	return new Response(null, { status: 204 });
};
