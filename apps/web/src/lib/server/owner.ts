// Owner flows (G5, BACKEND §4): claim a stay/eatery; edit fact fields only (prices, menu, timings, contact).
// Ratings/reviews are never writable here; DB triggers + RLS enforce the same rules (tested in pgTAP).
import { z } from 'zod';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '#lib/db.types.ts';

type DB = SupabaseClient<Database>;
const phone = z
	.string()
	.trim()
	.regex(/^\+?[\d\s-]{6,20}$/)
	.or(z.literal(''))
	.transform((s) => s || null);
const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/);

export const claimInput = z.object({ type: z.enum(['stay', 'eatery']), id: z.uuid() });

export async function claim(db: DB, user: User, c: z.infer<typeof claimInput>) {
	const { data: open } = await db
		.from('owner_claims')
		.select('id')
		.eq('user_id', user.id)
		.eq('entity_id', c.id)
		.eq('status', 'pending')
		.maybeSingle();
	if (open) return { pending: true };
	const { error } = await db
		.from('owner_claims')
		.insert({ user_id: user.id, entity_type: c.type, entity_id: c.id, email: user.email ?? '' });
	if (error) throw error;
	return { pending: true };
}

export const stayFacts = z
	.object({
		type: z.literal('stay'),
		price_min: z.number().int().min(0).nullable(),
		price_max: z.number().int().min(0).nullable(),
		phone,
		whatsapp: phone
	})
	.refine(
		(s) => s.price_min == null || s.price_max == null || s.price_max >= s.price_min,
		'price range'
	);

export const eateryFacts = z.object({
	type: z.literal('eatery'),
	price_for_two: z.number().int().min(0).nullable(),
	menu: z.array(z.string().trim().max(200)).max(100),
	phone,
	whatsapp: phone,
	hours: z
		.array(
			z.object({
				weekday: z.number().int().min(0).max(6),
				opens: time.nullable(),
				closes: time.nullable(),
				hours_unknown: z.boolean()
			})
		)
		.max(7)
});
export const parseFacts = (b: unknown) =>
	((b as { type?: string } | null)?.type === 'stay' ? stayFacts : eateryFacts).safeParse(b);

export async function updateFacts(
	db: DB,
	id: string,
	f: z.infer<typeof stayFacts> | z.infer<typeof eateryFacts>
) {
	if (f.type === 'stay') {
		const { error, count } = await db
			.from('stays')
			.update(
				{
					price_min: f.price_min,
					price_max: f.price_max,
					price_source: f.price_min != null ? 'owner' : null,
					phone: f.phone,
					whatsapp: f.whatsapp
				},
				{ count: 'exact' }
			)
			.eq('id', id);
		if (error) throw error;
		if (!count) throw Object.assign(new Error('not your listing'), { code: '42501' });
		return;
	}
	const { error, count } = await db
		.from('eateries')
		.update(
			{
				price_for_two: f.price_for_two,
				menu: { items: f.menu.filter(Boolean) },
				phone: f.phone,
				whatsapp: f.whatsapp
			},
			{ count: 'exact' }
		)
		.eq('id', id);
	if (error) throw error;
	if (!count) throw Object.assign(new Error('not your listing'), { code: '42501' });
	await db.from('eatery_hours').delete().eq('eatery_id', id);
	if (f.hours.length) {
		const { error: e } = await db
			.from('eatery_hours')
			.insert(f.hours.map((h) => ({ eatery_id: id, ...h })));
		if (e) throw e;
	}
}
