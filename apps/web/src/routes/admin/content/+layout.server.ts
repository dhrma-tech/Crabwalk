import { TYPES, type EntryType } from '#lib/admin/fields.ts';
import { adminEditor, listEntries, options } from '#lib/server/content.ts';
import type { LayoutServerLoad } from './$types';

// Admin editor list (every place / stay / eatery / dish) with filters. The admin is checked server-side here and
// again by every API call; the list is read with the service role.
export const load: LayoutServerLoad = async (event) => {
	const editor = await adminEditor(event);
	event.depends('admin:list');
	const sp = event.url.searchParams;
	const pick = (t: string | null | undefined) => (TYPES as readonly string[]).includes(t ?? '');
	const type: EntryType = pick(event.params.type)
		? (event.params.type as EntryType)
		: pick(sp.get('type'))
			? (sp.get('type') as EntryType)
			: 'place';
	const f = {
		taluka: sp.get('taluka') ?? '',
		status: sp.get('status') ?? '',
		cat: sp.get('cat') ?? '',
		missing: sp.get('missing') === '1',
		q: (sp.get('q') ?? '').trim().toLowerCase(),
		sort: sp.get('sort') ?? 'complete'
	};
	const [all, opts] = await Promise.all([listEntries(type), options()]);
	const items = all
		.filter((e) =>
			f.status === 'archived'
				? !!e.archived_at
				: f.status
					? e.status === f.status && !e.archived_at
					: !e.archived_at
		)
		.filter((e) => !f.taluka || e.taluka_id === f.taluka)
		.filter((e) => !f.cat || e.category === f.cat)
		.filter((e) => !f.missing || e.missing > 0)
		.filter(
			(e) =>
				!f.q || e.name.toLowerCase().includes(f.q) || (e.code ?? '').toLowerCase().includes(f.q)
		)
		.sort((a, b) =>
			f.sort === 'complete_desc'
				? b.percent - a.percent
				: f.sort === 'name'
					? a.name.localeCompare(b.name)
					: f.sort === 'edited'
						? (b.last_edited_at ?? '').localeCompare(a.last_edited_at ?? '')
						: a.percent - b.percent
		);
	const cats = [...new Set(all.map((e) => e.category).filter((c): c is string => !!c))].sort();
	return { editor, type, filters: f, items, total: all.length, cats, ...opts };
};
