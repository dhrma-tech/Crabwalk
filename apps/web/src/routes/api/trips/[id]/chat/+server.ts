import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { getLocale } from '#lib/paraglide/runtime.js';
import { session } from '#lib/server/auth.ts';
import type { Lang } from '#lib/server/listings.ts';
import { listChat, postMessage, screen } from '#lib/server/chat/trip-chat.ts';
import { crabbyInGroup } from '#lib/server/ai/group.ts';
import type { RequestHandler } from './$types';

const TABLE = { place: 'places', stay: 'stays', eatery: 'eateries' } as const;
const TR = {
	place: 'place_translations',
	stay: 'stay_translations',
	eatery: 'eatery_translations'
} as const;
const HREF = { place: '/place/', stay: '/stays/', eatery: '/food/' } as const;
const body = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('text'), body: z.string().trim().min(1).max(1000) }),
	z.object({
		kind: z.literal('poll'),
		question: z.string().trim().min(3).max(200),
		options: z.array(z.string().trim().min(1).max(60)).min(2).max(4),
		multi: z.boolean().default(false)
	}),
	z.object({
		kind: z.literal('card'),
		type: z.enum(['place', 'stay', 'eatery']),
		slug: z.string().regex(/^[a-z0-9-]{1,120}$/)
	})
]);

// GET /api/trips/:id/chat — the trip's group chat (P12 step G, 10.8): tripmates only (RLS).
export const GET: RequestHandler = async (event) => {
	const { user } = await session(event);
	const trip = z.uuid().safeParse(event.params.id);
	if (!trip.success) error(400, 'bad request');
	return json(await listChat(event.locals.supabase, trip.data.toLowerCase(), user.id), {
		headers: { 'Cache-Control': 'private, no-store' }
	});
};

// POST — a text, poll or shared listing. People's text and polls are moderated first; then Crabby may answer
// (tagged, or at a planning moment within the group's cap) after the response, so the sender never waits.
export const POST: RequestHandler = async (event) => {
	const { user } = await session(event);
	const id = z.uuid().safeParse(event.params.id);
	const b = body.safeParse(await event.request.json().catch(() => null));
	if (!id.success || !b.success) error(400, 'bad request');
	const trip = id.data.toLowerCase();
	const db = event.locals.supabase;
	const m = b.data;
	if (m.kind === 'card') {
		const { data } = await db
			.from(TABLE[m.type])
			.select(`slug, names:${TR[m.type]}(lang, name)`)
			.eq('slug', m.slug)
			.eq('status', 'published')
			.maybeSingle();
		if (!data) error(404, 'not found');
		const names = (data as unknown as { names: { lang: string; name: string | null }[] }).names;
		const title =
			names.find((n) => n.lang === getLocale())?.name ??
			names.find((n) => n.lang === 'en')?.name ??
			m.slug;
		await postMessage(db, trip, {
			kind: 'card',
			body: title,
			payload: { listing: { type: m.type, slug: m.slug, href: `${HREF[m.type]}${m.slug}` }, title }
		}).catch(() => error(403, 'not a tripmate'));
		return json({ ok: true });
	}
	const text = m.kind === 'text' ? m.body : `${m.question}\n${m.options.join('\n')}`;
	if (!(await screen(text))) return json({ ok: false, refused: true }, { status: 422 });
	await postMessage(
		db,
		trip,
		m.kind === 'text'
			? { kind: 'text', body: m.body }
			: { kind: 'poll', body: m.question, payload: { options: m.options, multi: m.multi } }
	).catch(() => error(403, 'not a tripmate'));
	if (m.kind === 'text') {
		const job = crabbyInGroup(db, user.id, trip, getLocale() as Lang, m.body).catch((e) =>
			console.error('crabby group', e instanceof Error ? e.message : e)
		);
		if (event.platform?.ctx?.waitUntil) event.platform.ctx.waitUntil(job);
		else await job;
	}
	return json({ ok: true });
};
