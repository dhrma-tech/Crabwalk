import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { requireStaff } from '#lib/server/auth.ts';
import type { Actions, PageServerLoad } from './$types';

// Festivals / events calendar (PLAN P7 task 11): Ganpati, Shimga, jatras, mango season…
// impact.crowd = 'busy' makes the planner treat places in that taluka as busy on those dates.
export const load: PageServerLoad = async (event) => {
	await requireStaff(event, 'admin');
	const db = event.locals.supabase;
	const [{ data: events }, { data: talukas }] = await Promise.all([
		db.from('events_calendar').select('*').order('from_date', { ascending: false }).limit(300),
		db.from('talukas').select('id, name_en').order('name_en')
	]);
	return { events: events ?? [], talukas: talukas ?? [] };
};

const row = z
	.object({
		id: z.union([z.uuid(), z.literal('')]),
		name_en: z.string().trim().min(1).max(120),
		name_hi: z.string().trim().max(120),
		name_mr: z.string().trim().max(120),
		type: z.enum(['festival', 'jatra', 'season']),
		from_date: z.iso.date(),
		to_date: z.iso.date(),
		taluka_id: z.union([z.uuid(), z.literal('')]),
		crowd: z.enum(['', 'busy', 'calm']),
		closures: z.string().trim().max(300)
	})
	.refine((r) => r.to_date >= r.from_date);

export const actions: Actions = {
	save: async (event) => {
		await requireStaff(event, 'admin');
		const b = row.safeParse(Object.fromEntries(await event.request.formData()));
		if (!b.success) return fail(400, { error: true });
		const r = b.data;
		const values = {
			name_en: r.name_en,
			name_hi: r.name_hi || null,
			name_mr: r.name_mr || null,
			type: r.type,
			from_date: r.from_date,
			to_date: r.to_date,
			taluka_id: r.taluka_id || null,
			impact: {
				...(r.crowd ? { crowd: r.crowd } : {}),
				...(r.closures ? { closures: r.closures } : {})
			}
		};
		const t = event.locals.supabase.from('events_calendar');
		const { error } = r.id ? await t.update(values).eq('id', r.id) : await t.insert(values);
		if (error) return fail(403, { error: true });
		return { saved: true };
	},
	delete: async (event) => {
		await requireStaff(event, 'admin');
		const id = z.uuid().safeParse((await event.request.formData()).get('id'));
		if (!id.success) return fail(400);
		const { error } = await event.locals.supabase
			.from('events_calendar')
			.delete()
			.eq('id', id.data);
		if (error) return fail(403);
	}
};
