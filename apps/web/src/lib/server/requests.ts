// Crabby books the unbookable (P12 step I, product plan 10.2): availability requests for homestays and eateries
// that aren't on any OTA. The traveller sends dates, guests and budget; a claimed owner answers in one tap (or
// counters once); for unclaimed listings our team relays by a prefilled WhatsApp message (a manual tap — no paid
// API) and enters the reply. Crabby never confirms a booking or takes payment, and the traveller's phone reaches
// the owner only after they accept (DB guard). Who may change what is enforced in the database.
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/db.types.ts';
import { msg } from '#lib/msg.ts';
import { tr, type Lang } from './listings.ts';

type DB = SupabaseClient<Database>;
const TABLE = { stay: 'stays', eatery: 'eateries' } as const;
const TR = { stay: 'stay_translations', eatery: 'eatery_translations' } as const;

export const requestInput = z
	.object({
		type: z.enum(['stay', 'eatery']),
		slug: z.string().regex(/^[a-z0-9-]{1,120}$/),
		check_in: z.iso.date(),
		check_out: z.iso.date().nullable().default(null),
		guests: z.coerce.number().int().min(1).max(50),
		budget: z.coerce.number().int().min(0).max(1_000_000).nullable().default(null),
		note: z.string().trim().max(300).default('')
	})
	.refine((r) => !r.check_out || r.check_out > r.check_in, { path: ['check_out'] });
export type RequestInput = z.infer<typeof requestInput>;

/** File a request; false when the listing isn't found (or a DB rule refuses it, e.g. 10 a day). */
export async function createRequest(db: DB, r: RequestInput) {
	const { data } = await db
		.from(TABLE[r.type])
		.select('id')
		.eq('slug', r.slug)
		.eq('status', 'published')
		.maybeSingle();
	if (!data) return false;
	const { error } = await db.from('stay_requests').insert({
		entity_type: r.type,
		entity_id: data.id,
		check_in: r.check_in,
		check_out: r.check_out,
		guests: r.guests,
		budget: r.budget,
		note: r.note || null
	});
	return !error;
}

export type RequestRow = Database['public']['Tables']['stay_requests']['Row'];
/** Requests with the listing's name, link and (for the team) WhatsApp number. */
export async function withListings(db: DB, rows: RequestRow[], lang: Lang) {
	const ids = (t: 'stay' | 'eatery') =>
		rows.filter((r) => r.entity_type === t).map((r) => r.entity_id);
	const fetch = (t: 'stay' | 'eatery') =>
		ids(t).length
			? db
					.from(TABLE[t])
					.select(`id, slug, phone, whatsapp, names:${TR[t]}(lang, name)`)
					.in('id', ids(t))
					.then((r) => (r.data ?? []) as unknown as Listing[])
			: Promise.resolve([] as Listing[]);
	type Listing = {
		id: string;
		slug: string;
		phone: string | null;
		whatsapp: string | null;
		names: { lang: string; name: string | null }[];
	};
	const [s, e] = await Promise.all([fetch('stay'), fetch('eatery')]);
	const by = new Map<string, Listing & { type: 'stay' | 'eatery' }>();
	for (const x of s) by.set(x.id, { ...x, type: 'stay' });
	for (const x of e) by.set(x.id, { ...x, type: 'eatery' });
	return rows.map((r) => {
		const l = by.get(r.entity_id);
		return {
			...r,
			name: l ? (tr(l.names, lang) ?? l.slug) : '—',
			href: l ? `${l.type === 'stay' ? '/stays/' : '/food/'}${l.slug}` : null,
			whatsapp: l?.whatsapp ?? l?.phone ?? null
		};
	});
}

/** Prefilled WhatsApp text for the team to send an unclaimed owner (dates, guests, budget — no traveller details). */
export function relayLink(phone: string | null, r: RequestRow, name: string, lang: Lang) {
	const digits = (phone ?? '').replace(/\D/g, '');
	if (digits.length < 10) return null;
	const to = digits.length === 10 ? `91${digits}` : digits;
	const text = msg(
		'req_relay_text',
		{
			name,
			dates: r.check_out ? `${r.check_in} – ${r.check_out}` : r.check_in,
			guests: r.guests,
			budget: r.budget != null ? `₹${r.budget}` : '—'
		},
		lang
	);
	return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

const reply = z.object({
	id: z.uuid(),
	answer: z.enum(['available', 'unavailable', 'countered', 'relayed']),
	price: z
		.union([z.literal(''), z.coerce.number().int().min(0).max(10_000_000)])
		.optional()
		.transform((v) => (v === '' || v === undefined ? null : v)),
	note: z.string().trim().max(300).default('')
});
/** An owner's (or the team's) one-tap answer; a counter offer only once (DB guard). False if refused. */
export async function replyRequest(db: DB, form: FormData) {
	const b = reply.safeParse(Object.fromEntries(form));
	if (!b.success) return false;
	const r = b.data;
	const fields =
		r.answer === 'relayed'
			? { status: 'relayed' as const }
			: r.answer === 'countered'
				? { status: 'countered' as const, counter_price: r.price, owner_note: r.note || null }
				: r.answer === 'available'
					? { status: 'available' as const, owner_price: r.price, owner_note: r.note || null }
					: { status: 'unavailable' as const, owner_note: r.note || null };
	const { error } = await db.from('stay_requests').update(fields).eq('id', r.id);
	return !error;
}
