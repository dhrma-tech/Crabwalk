import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { session } from '#lib/server/auth.ts';
import type { RequestHandler, RequestEvent } from './$types';

// /api/saved (DECISIONS T-5 / T-46): the signed-in visitor's hearted listings, keyed by type + slug like every card.
// Own rows only (RLS); never cached (private data: no-store here, and the service worker skips /api/saved).
const TABLE = { place: 'places', stay: 'stays', eatery: 'eateries' } as const;
const item = z.object({
	type: z.enum(['place', 'stay', 'eatery']),
	slug: z.string().min(1).max(200)
});
const headers = { 'Cache-Control': 'private, no-store' };

/** The published listing's id, or 404. */
async function idOf(event: RequestEvent, i: z.infer<typeof item>) {
	const { data } = await event.locals.supabase
		.from(TABLE[i.type])
		.select('id')
		.eq('slug', i.slug)
		.eq('status', 'published')
		.maybeSingle();
	if (!data) error(404, 'not found');
	return data.id;
}

// GET → [{ type, slug }], newest first.
export const GET: RequestHandler = async (event) => {
	await session(event);
	const db = event.locals.supabase;
	const { data } = await db
		.from('saved_items')
		.select('entity_type, entity_id')
		.order('created_at', { ascending: false });
	const rows = data ?? [];
	const ids = (t: keyof typeof TABLE) =>
		rows.filter((r) => r.entity_type === t).map((r) => r.entity_id);
	const slugs = new Map<string, string>();
	await Promise.all(
		(Object.keys(TABLE) as (keyof typeof TABLE)[]).map(async (t) => {
			if (!ids(t).length) return;
			const { data: l } = await db.from(TABLE[t]).select('id, slug').in('id', ids(t));
			for (const x of l ?? []) slugs.set(x.id, x.slug);
		})
	);
	return json(
		rows
			.filter((r) => slugs.has(r.entity_id))
			.map((r) => ({ type: r.entity_type, slug: slugs.get(r.entity_id)! })),
		{ headers }
	);
};

// POST { type, slug } → saved (saving twice is fine).
export const POST: RequestHandler = async (event) => {
	await session(event);
	const b = item.safeParse(await event.request.json().catch(() => null));
	if (!b.success) error(400, 'bad request');
	const { error: err } = await event.locals.supabase
		.from('saved_items')
		.upsert(
			{ entity_type: b.data.type, entity_id: await idOf(event, b.data) },
			{ onConflict: 'user_id,entity_type,entity_id', ignoreDuplicates: true }
		);
	if (err) error(500, 'save failed');
	return json({ ok: true }, { status: 201, headers });
};

// DELETE ?type=&slug= → removed.
export const DELETE: RequestHandler = async (event) => {
	await session(event);
	const b = item.safeParse(Object.fromEntries(event.url.searchParams));
	if (!b.success) error(400, 'bad request');
	const { error: err } = await event.locals.supabase
		.from('saved_items')
		.delete()
		.eq('entity_type', b.data.type)
		.eq('entity_id', await idOf(event, b.data));
	if (err) error(500, 'remove failed');
	return json({ ok: true }, { headers });
};
