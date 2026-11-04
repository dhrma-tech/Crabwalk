import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { getLocale } from '#lib/paraglide/runtime.js';
import { session } from '#lib/server/auth.ts';
import type { Lang } from '#lib/server/listings.ts';
import type { RequestHandler } from './$types';

// Shared journal photos (P12 step M, P12-0): only photos the user puts in their journal are uploaded — webp,
// re-encoded on the phone (no EXIF), ≤ 300 KB, ≤ 20 per user (DB guard). Clips and other photos stay on the phone.
const MAX = 300 * 1024;

async function journalId(event: Parameters<RequestHandler>[0], userId: string) {
	const db = event.locals.supabase;
	const trip = z.uuid().safeParse(event.params.id);
	if (!trip.success) error(404, 'not found');
	const { data: j } = await db
		.from('trip_journals')
		.select('id')
		.eq('trip_id', trip.data)
		.eq('user_id', userId)
		.maybeSingle();
	if (j) return j.id;
	const { data: n } = await db
		.from('trip_journals')
		.insert({ trip_id: trip.data, lang: getLocale() as Lang })
		.select('id')
		.single();
	if (!n) error(404, 'not found');
	return n.id;
}

export const POST: RequestHandler = async (event) => {
	const { user } = await session(event);
	const form = await event.request.formData().catch(() => null);
	const file = form?.get('photo');
	if (!(file instanceof File) || file.type !== 'image/webp' || file.size > MAX)
		error(400, 'bad photo');
	const caption =
		String(form?.get('caption') ?? '')
			.trim()
			.slice(0, 200) || null;
	const db = event.locals.supabase;
	const jid = await journalId(event, user.id);
	const path = `${user.id}/${jid}/${crypto.randomUUID()}.webp`;
	// Row first: the DB guard enforces the 20-photo cap before anything is stored.
	const { data: row, error: e } = await db
		.from('journal_photos')
		.insert({ journal_id: jid, path, caption })
		.select('id, path, caption, created_at')
		.single();
	if (e) error(e.code === 'CW429' ? 429 : 403, 'photo not saved');
	const { error: up } = await db.storage
		.from('journal')
		.upload(path, file, { contentType: 'image/webp' });
	if (up) {
		await db.from('journal_photos').delete().eq('id', row.id);
		error(403, 'photo not saved');
	}
	return json(row, { status: 201 });
};

export const DELETE: RequestHandler = async (event) => {
	const { user } = await session(event);
	const id = z.uuid().safeParse(event.url.searchParams.get('photo'));
	if (!id.success) error(400, 'bad request');
	const db = event.locals.supabase;
	const { data: p } = await db
		.from('journal_photos')
		.delete()
		.eq('id', id.data)
		.eq('user_id', user.id)
		.select('path')
		.maybeSingle();
	if (!p) error(404, 'not found');
	await db.storage.from('journal').remove([p.path]);
	return new Response(null, { status: 204 });
};
