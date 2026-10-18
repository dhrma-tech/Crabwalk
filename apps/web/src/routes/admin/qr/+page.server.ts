import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { getLocale } from '#lib/paraglide/runtime.js';
import { Constants } from '#lib/db.types.ts';
import { requireStaff } from '#lib/server/auth.ts';
import { tr, type Lang } from '#lib/server/listings.ts';
import type { Actions, PageServerLoad } from './$types';

type QrType = (typeof Constants.public.Enums.qr_entity_type)[number];
const TYPES = Constants.public.Enums.qr_entity_type;

/** id → display name for every target a code can point at (admin sees drafts too). */
async function targets(db: App.Locals['supabase'], type: QrType, lang: Lang) {
	if (type === 'station' || type === 'bus_stand') {
		const { data } = await db
			.from('utility_pois')
			.select('id, name')
			.eq('type', type === 'station' ? 'railway_station' : 'bus_stand')
			.order('name')
			.limit(500);
		return (data ?? []).map((u) => ({ id: u.id, name: u.name ?? u.id }));
	}
	const sel = {
		place: 'id, slug, place_translations(lang, name)',
		stay: 'id, slug, stay_translations(lang, name)',
		eatery: 'id, slug, eatery_translations(lang, name)'
	}[type];
	const table = { place: 'places', stay: 'stays', eatery: 'eateries' }[type] as 'places';
	const { data } = await db.from(table).select(sel).order('slug').limit(500);
	return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
		id: r.id as string,
		name:
			tr(r[`${type}_translations`] as { lang: string; name: string }[], lang) ?? (r.slug as string)
	}));
}

// QR codes (PLAN P6 tasks 1, 7): create short codes, record plaque permission/installation/sponsor.
export const load: PageServerLoad = async (event) => {
	await requireStaff(event, 'admin');
	const lang = getLocale() as Lang;
	const db = event.locals.supabase;
	const type = (TYPES as readonly string[]).includes(event.url.searchParams.get('type') ?? '')
		? (event.url.searchParams.get('type') as QrType)
		: 'place';
	const [{ data: codes }, options] = await Promise.all([
		db.from('qr_codes').select('*, sponsors(name)').order('code', { ascending: false }).limit(500),
		targets(db, type, lang)
	]);
	const names = new Map<string, string>();
	for (const t of TYPES) {
		const ids = new Set((codes ?? []).filter((c) => c.entity_type === t).map((c) => c.entity_id));
		if (ids.size)
			for (const o of await targets(db, t, lang)) if (ids.has(o.id)) names.set(o.id, o.name);
	}
	return {
		type,
		types: TYPES,
		options,
		codes: (codes ?? []).map((c) => ({
			...c,
			sponsor: (c.sponsors as { name: string } | null)?.name ?? '',
			target: names.get(c.entity_id) ?? c.entity_id
		}))
	};
};

const edit = z.object({
	code: z.string(),
	permission_status: z.enum(['pending', 'granted']),
	permission_body: z.string().trim().max(200),
	installed_at: z.union([z.iso.date(), z.literal('')]),
	sponsor: z.string().trim().max(120)
});

export const actions: Actions = {
	create: async (event) => {
		await requireStaff(event, 'admin');
		const f = Object.fromEntries(await event.request.formData());
		const b = z.object({ type: z.enum(TYPES), id: z.uuid() }).safeParse(f);
		if (!b.success) return fail(400, { error: 'create' });
		const { data, error } = await event.locals.supabase.rpc('create_qr_code', {
			_type: b.data.type,
			_id: b.data.id
		});
		if (error) return fail(400, { error: 'create' });
		return { created: data };
	},
	save: async (event) => {
		await requireStaff(event, 'admin');
		const b = edit.safeParse(Object.fromEntries(await event.request.formData()));
		if (!b.success) return fail(400, { error: 'save' });
		const db = event.locals.supabase;
		let sponsor_id: string | null = null;
		if (b.data.sponsor) {
			const { data: s } = await db
				.from('sponsors')
				.select('id')
				.eq('name', b.data.sponsor)
				.limit(1)
				.maybeSingle();
			sponsor_id =
				s?.id ??
				(await db.from('sponsors').insert({ name: b.data.sponsor }).select('id').single()).data
					?.id ??
				null;
		}
		const { error } = await db
			.from('qr_codes')
			.update({
				permission_status: b.data.permission_status,
				permission_body: b.data.permission_body || null,
				installed_at: b.data.installed_at || null,
				sponsor_id
			})
			.eq('code', b.data.code);
		if (error) return fail(403, { error: 'save' });
		return { saved: b.data.code };
	}
};
