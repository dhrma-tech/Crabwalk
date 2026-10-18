import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { requireStaff } from '#lib/server/auth.ts';
import { photosFor, photoUrls } from '#lib/server/listings.ts';
import { entity, FIELDS, isReviewType, loadText, publish, saveDrafts } from '#lib/server/review.ts';
import { draftContent } from '#lib/server/ai/drafting.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const s = await requireStaff(event, 'reviewer');
	const { type, id } = event.params;
	if (!isReviewType(type)) error(404, 'not found');
	const db = event.locals.supabase;
	const row = await entity(db, type, id);
	if (!row) error(404, 'not found');
	const [text, photos, notes, offers] = await Promise.all([
		loadText(db, type, id),
		photosFor(db, type, [id]),
		type === 'place'
			? db.from('verifier_notes').select('notes, created_at').eq('place_id', id).order('created_at')
			: Promise.resolve({ data: [] }),
		type === 'stay'
			? db
					.from('stay_offers')
					.select('id, provider, deep_link, affiliate_network')
					.eq('stay_id', id)
			: Promise.resolve({ data: [] })
	]);
	const facts = Object.fromEntries(
		Object.entries(row).filter(
			([k, v]) =>
				v != null &&
				!['id', 'location', 'created_at', 'updated_at', 'is_seed', 'owner_id'].includes(k)
		)
	);
	return {
		type,
		id,
		status: (row.status as string | undefined) ?? null,
		fields: FIELDS[type],
		text,
		facts,
		notes: notes.data ?? [],
		offers: offers.data ?? [],
		photos: (photos.get(id) ?? []).map((p) => photoUrls(p, '')),
		isAdmin: s.isAdmin
	};
};

const offer = z.object({
	provider: z
		.string()
		.trim()
		.toLowerCase()
		.regex(/^[a-z_]{2,30}$/),
	deep_link: z.url({ protocol: /^https$/ }),
	affiliate_network: z
		.enum(['agoda_partners', 'inrdeals', 'cuelinks'])
		.or(z.literal(''))
		.transform((v) => v || null)
});

export const actions: Actions = {
	// AI drafts fill empty fields only; the reviewer still checks every fact (PLAN P8 task 9).
	draft: async (event) => {
		await requireStaff(event, 'reviewer');
		const { type, id } = event.params;
		if (!isReviewType(type)) error(404, 'not found');
		try {
			return { drafted: (await draftContent(event.locals.supabase, type, id)).filled };
		} catch {
			return fail(503, { error: 'draft' });
		}
	},
	save: async (event) => {
		await requireStaff(event, 'reviewer');
		const { type, id } = event.params;
		if (!isReviewType(type)) error(404, 'not found');
		try {
			await saveDrafts(event.locals.supabase, type, id, await event.request.formData());
		} catch {
			return fail(400, { error: 'save' });
		}
		return { saved: true };
	},
	publish: async (event) => {
		await requireStaff(event, 'reviewer');
		const { type, id } = event.params;
		if (!isReviewType(type)) error(404, 'not found');
		try {
			await saveDrafts(event.locals.supabase, type, id, await event.request.formData());
			await publish(event.locals.supabase, type, id);
		} catch {
			return fail(400, { error: 'publish' });
		}
		return { published: true };
	},
	addOffer: async (event) => {
		await requireStaff(event, 'admin');
		const o = offer.safeParse(Object.fromEntries(await event.request.formData()));
		if (!o.success) return fail(400, { error: 'offer' });
		const { error: err } = await event.locals.supabase
			.from('stay_offers')
			.insert({ stay_id: event.params.id, ...o.data });
		if (err) return fail(403, { error: 'offer' });
	},
	removeOffer: async (event) => {
		await requireStaff(event, 'admin');
		const oid = String((await event.request.formData()).get('offer') ?? '');
		await event.locals.supabase
			.from('stay_offers')
			.delete()
			.eq('id', oid)
			.eq('stay_id', event.params.id);
	},
	audio: async (event) => {
		await requireStaff(event, 'reviewer');
		const form = await event.request.formData();
		const file = form.get('file');
		const lang = String(form.get('lang'));
		const duration = Math.round(Number(form.get('duration')));
		if (
			!(file instanceof File) ||
			!['en', 'hi', 'mr'].includes(lang) ||
			!(duration >= 60 && duration <= 300)
		)
			return fail(400, { error: 'audio' });
		const ext =
			file.type === 'audio/mpeg'
				? 'mp3'
				: file.type === 'audio/mp4'
					? 'm4a'
					: file.type === 'audio/ogg'
						? 'ogg'
						: 'webm';
		const path = `place/${event.params.id}/${lang}.${ext}`;
		const { error: up } = await event.locals.supabase.storage
			.from('audio')
			.upload(path, file, { contentType: file.type, upsert: true });
		if (up) return fail(403, { error: 'audio' });
		const { error: err } = await event.locals.supabase.from('audio_guides').upsert(
			{
				place_id: event.params.id,
				lang: lang as 'en' | 'hi' | 'mr',
				storage_path: path,
				duration_s: duration,
				transcript: String(form.get('transcript') ?? '') || null,
				source: 'recorded'
			},
			{ onConflict: 'place_id,lang' }
		);
		if (err) return fail(403, { error: 'audio' });
		return { audio: true };
	}
};
