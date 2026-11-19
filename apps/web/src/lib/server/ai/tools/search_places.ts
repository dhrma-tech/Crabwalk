import { CATS, obj, str, int, n, read, type Tool } from './shared.ts';

export const searchPlacesTool: Tool = {
	def: {
		name: 'search_places',
		description: 'Find published places. Use for any question about spots to visit.',
		parameters: obj({
			category: str('Place category', { enum: CATS }),
			name: str('Part of a place name'),
			hidden_gem: { type: 'boolean' },
			limit: int('Max results (≤ 8)')
		})
	},
	async run(ctx, a) {
		const { db, lang } = ctx;
		const { s, i } = read(a);
		let q = db
			.from('places')
			.select(
				'slug, category, is_hidden_gem, monsoon_status, place_translations!inner(lang, name), talukas(name_en)'
			)
			.eq('status', 'published')
			.limit(Math.min(i('limit') ?? 6, 8));
		if (s('category')) q = q.eq('category', s('category') as (typeof CATS)[number]);
		if (a.hidden_gem === true) q = q.eq('is_hidden_gem', true);
		if (s('name')) q = q.ilike('place_translations.name', `%${s('name')!.replace(/[%_]/g, '')}%`);
		const { data } = await q;
		return (data ?? []).map((p) => ({
			slug: p.slug,
			name: n(p.place_translations, lang),
			category: p.category,
			hidden_gem: p.is_hidden_gem,
			monsoon: p.monsoon_status,
			taluka: (p.talukas as { name_en: string } | null)?.name_en ?? null
		}));
	}
};
