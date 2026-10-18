import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { Constants } from '#lib/db.types.ts';
import { requireStaff } from '#lib/server/auth.ts';
import { lonLat } from '#lib/server/listings.ts';
import type { Actions, PageServerLoad } from './$types';

// Road / ghat / landslide / closure alerts (G9): expire after their type TTL unless re-confirmed.
export const load: PageServerLoad = async (event) => {
	await requireStaff(event);
	const { data } = await event.locals.supabase
		.from('alerts')
		.select('id, type, severity, reason_en, reported_at, expires_at, confirmed_at, geometry')
		.gt('expires_at', new Date().toISOString())
		.order('expires_at')
		.limit(200);
	return {
		types: Constants.public.Enums.alert_type,
		alerts: (data ?? []).map(({ geometry, ...a }) => ({ ...a, at: lonLat(geometry) }))
	};
};

const input = z.object({
	type: z.enum(Constants.public.Enums.alert_type),
	severity: z.enum(['caution', 'danger']),
	reason_en: z.string().trim().min(3).max(300),
	reason_hi: z.string().trim().max(300),
	reason_mr: z.string().trim().max(300),
	lon: z.coerce.number().min(-180).max(180),
	lat: z.coerce.number().min(-90).max(90)
});

export const actions: Actions = {
	create: async (event) => {
		await requireStaff(event);
		const b = input.safeParse(Object.fromEntries(await event.request.formData()));
		if (!b.success) return fail(400, { error: true });
		const db = event.locals.supabase;
		const { data: ttl } = await db
			.from('alert_type_ttl')
			.select('ttl_hours')
			.eq('type', b.data.type)
			.maybeSingle();
		const hours = ttl?.ttl_hours ?? 24;
		const { error } = await db.from('alerts').insert({
			type: b.data.type,
			severity: b.data.severity,
			reason_en: b.data.reason_en,
			reason_hi: b.data.reason_hi || null,
			reason_mr: b.data.reason_mr || null,
			geometry: `SRID=4326;POINT(${b.data.lon} ${b.data.lat})`,
			source: 'verifier',
			expires_at: new Date(Date.now() + hours * 3600e3).toISOString()
		});
		if (error) return fail(403, { error: true });
		return { created: true };
	},
	confirm: async (event) => {
		await requireStaff(event);
		const id = z.uuid().safeParse((await event.request.formData()).get('id'));
		if (!id.success) return fail(400);
		const { error } = await event.locals.supabase.rpc('confirm_alert', { _id: id.data });
		if (error) return fail(403);
	},
	remove: async (event) => {
		await requireStaff(event);
		const id = z.uuid().safeParse((await event.request.formData()).get('id'));
		if (!id.success) return fail(400);
		const { error } = await event.locals.supabase
			.from('alerts')
			.update({ expires_at: new Date().toISOString() })
			.eq('id', id.data);
		if (error) return fail(403);
	}
};
