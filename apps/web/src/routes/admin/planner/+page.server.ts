import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { Constants } from '#lib/db.types.ts';
import { requireStaff } from '#lib/server/auth.ts';
import { serviceClient } from '#lib/server/service.ts';
import type { Actions, PageServerLoad } from './$types';

type Readiness = {
	published: number;
	no_matrix_point: number;
	no_hours: number;
	no_seasonal: number;
	tide_dependent: number;
	tide_no_rule: number;
};

// Planner settings (DECISIONS P7-2, P7-6): fuel price + default mileage, visit minutes per category.
// Hardening T2-08: readiness counts (service-role RPC, read after the admin check).
export const load: PageServerLoad = async (event) => {
	await requireStaff(event, 'admin');
	const db = event.locals.supabase;
	const [{ data: cfg }, { data: cats }, { data: ready }] = await Promise.all([
		db
			.from('app_config')
			.select('key, value')
			.in('key', ['fuel_price_inr', 'default_mileage_kmpl']),
		db.from('category_visit_minutes').select('category, minutes').order('category'),
		serviceClient().rpc('planner_readiness')
	]);
	const v = (k: string) => (cfg ?? []).find((r) => r.key === k)?.value as number | null;
	return {
		fuelPrice: v('fuel_price_inr') ?? null,
		mileage: v('default_mileage_kmpl') ?? null,
		cats: cats ?? [],
		ready: (ready as Readiness | null) ?? null
	};
};

const num = (max: number) =>
	z.union([z.literal('').transform(() => null), z.coerce.number().positive().max(max)]);

export const actions: Actions = {
	save: async (event) => {
		await requireStaff(event, 'admin');
		const f = Object.fromEntries(await event.request.formData());
		const b = z.object({ fuel_price_inr: num(1000), default_mileage_kmpl: num(100) }).safeParse(f);
		const cats = Constants.public.Enums.place_category.map((c) => ({
			category: c,
			minutes: Number(f[`min_${c}`])
		}));
		if (
			!b.success ||
			cats.some((c) => !Number.isInteger(c.minutes) || c.minutes < 10 || c.minutes > 600)
		)
			return fail(400, { error: true });
		const db = event.locals.supabase;
		const results = await Promise.all([
			// Blank = not set: the row goes away and the planner asks the user (P7-6).
			...Object.entries(b.data).map(([key, value]) =>
				value == null
					? db.from('app_config').delete().eq('key', key)
					: db.from('app_config').upsert({ key, value })
			),
			db.from('category_visit_minutes').upsert(cats)
		]);
		if (results.some((r) => r.error)) return fail(403, { error: true });
		return { saved: true };
	}
};
