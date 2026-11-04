import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { getLocale } from '#lib/paraglide/runtime.js';
import { session } from '#lib/server/auth.ts';
import type { Lang } from '#lib/server/listings.ts';
import { loadProfile } from '#lib/server/profile.ts';
import { isReelUrl, reelToTrip } from '#lib/server/ai/reel.ts';
import type { RequestHandler } from './$types';

const body = z
	.object({
		url: z.string().trim().max(500).refine(isReelUrl).nullable().default(null),
		caption: z.string().trim().max(2000).default(''),
		// A screenshot, re-encoded on the phone like snap and ask (≤ 1024 px, no EXIF/GPS).
		image: z
			.string()
			.regex(/^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/)
			.max(1_500_000)
			.nullable()
			.default(null)
	})
	.refine((b) => b.url || b.caption || b.image);

// POST /api/ai/reel — reel to trip (P12 step L, 10.6): 5 a day. Screenshots need the photo consent (Me → Crabby &
// you); the screenshot is not stored. An Instagram link alone asks for the caption first (free, not counted).
export const POST: RequestHandler = async (event) => {
	const { user } = await session(event);
	const b = body.safeParse(await event.request.json().catch(() => null));
	if (!b.success) error(400, 'bad request');
	const db = event.locals.supabase;
	if (b.data.image && !(await loadProfile(db, user.id))?.use_photos)
		return json({ kind: 'consent' }, { status: 403 });
	if (b.data.url && /instagram\.com/i.test(b.data.url) && !b.data.caption && !b.data.image)
		return json({ kind: 'need_caption' });
	const { error: cap } = await db.rpc('ai_take', { _feature: 'reel' });
	if (cap) return json({ kind: 'limit' }, { status: 429 });
	try {
		return json(await reelToTrip(db, user.id, getLocale() as Lang, b.data));
	} catch {
		return json({ kind: 'unavailable' }, { status: 503 });
	}
};
