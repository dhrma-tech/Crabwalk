import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { TYPES } from '#lib/admin/fields.ts';
import { adminEditor, brokenLinks, getEntry, reviewsFor } from '#lib/server/content.ts';
import { serviceClient } from '#lib/server/service.ts';
import type { PageServerLoad } from './$types';

// One entry in the admin editor (admin checked server-side; service role read, private fields included).
export const load: PageServerLoad = async (event) => {
	await adminEditor(event);
	const type = z.enum(TYPES).safeParse(event.params.type);
	const id = z.uuid().safeParse(event.params.id);
	if (!type.success || !id.success) error(404);
	const entry = await getEntry(type.data, id.data);
	if (!entry) error(404, 'entry not found');
	const [reviews, broken] = await Promise.all([
		reviewsFor(type.data, id.data),
		brokenLinks(type.data, entry.rows)
	]);
	// Names for linked dishes / eateries (pickers show names, not ids).
	const ids = new Set<string>();
	for (const r of [...(entry.rows.links ?? []), ...(entry.rows.menu_items ?? [])])
		for (const k of ['dish_id', 'eatery_id']) if (typeof r[k] === 'string') ids.add(r[k] as string);
	const labels: Record<string, string> = {};
	if (ids.size) {
		const db = serviceClient();
		const [d, e] = await Promise.all([
			db
				.from('dishes')
				.select('id, code, dish_translations(lang, name)')
				.in('id', [...ids]),
			db
				.from('eateries')
				.select('id, code, eatery_translations(lang, name)')
				.in('id', [...ids])
		]);
		for (const x of d.data ?? [])
			labels[x.id] =
				`${x.dish_translations.find((t) => t.lang === 'en')?.name ?? x.id}${x.code ? ` (${x.code})` : ''}`;
		for (const x of e.data ?? [])
			labels[x.id] =
				`${x.eatery_translations.find((t) => t.lang === 'en')?.name ?? x.id}${x.code ? ` (${x.code})` : ''}`;
	}
	return { entry, reviews, broken, labels };
};
