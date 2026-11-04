import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { getLocale } from '#lib/paraglide/runtime.js';
import { session } from '#lib/server/auth.ts';
import type { Lang } from '#lib/server/listings.ts';
import { loadProfile } from '#lib/server/profile.ts';
import { snapAsk } from '#lib/server/ai/snap.ts';
import type { RequestHandler } from './$types';

const body = z.object({
	// Re-encoded on the phone (≤ 1024 px, no EXIF/GPS).
	image: z
		.string()
		.regex(/^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/)
		.max(1_500_000),
	caption: z.string().trim().max(300).default(''),
	near: z.object({ lon: z.number(), lat: z.number() }).nullable().default(null)
});

// POST /api/ai/snap — snap and ask (P12 step K, 10.5): only with the traveller's photo consent (Me → Crabby &
// you), 5 a day. The photo is not stored.
export const POST: RequestHandler = async (event) => {
	const { user } = await session(event);
	const b = body.safeParse(await event.request.json().catch(() => null));
	if (!b.success) error(400, 'bad request');
	const db = event.locals.supabase;
	if (!(await loadProfile(db, user.id))?.use_photos)
		return json({ kind: 'consent' }, { status: 403 });
	const { error: cap } = await db.rpc('ai_take', { _feature: 'snap' });
	if (cap) return json({ kind: 'limit' }, { status: 429 });
	try {
		return json(await snapAsk(db, getLocale() as Lang, b.data.image, b.data.caption, b.data.near));
	} catch {
		return json({ kind: 'unavailable' }, { status: 503 });
	}
};
