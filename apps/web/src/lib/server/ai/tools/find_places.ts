import { CATS, obj, str, int, read, type Tool } from './shared.ts';

export const findPlacesTool: Tool = {
	def: {
		// T2-04 (AI Spec 5.5): what the traveller wants, not a name. No tags yet (no place tag vocabulary).
		name: 'find_places',
		description:
			'Find published places by what the traveller wants: categories, calm crowds, open in monsoon, a taluka, near a place, hidden gems, safe without tide timing. Each result says what it matched.',
		parameters: obj({
			categories: { type: 'array', items: str('category', { enum: CATS }) },
			crowd: str('Prefer calm places', { enum: ['calm'] }),
			monsoon_ok: { type: 'boolean', description: 'Only places open in the monsoon / rain' },
			taluka: str('Taluka name in English'),
			near: str('Place slug to search around'),
			max_km: int('Radius around `near` in km (default 25)'),
			hidden_gem: { type: 'boolean' },
			tide_free: { type: 'boolean', description: 'Only places that do not depend on the tide' },
			weekday: int('0 = Sunday … 6 = Saturday, for crowd; default today'),
			limit: int('Max results (≤ 8)')
		})
	},
	async run(ctx, a) {
		const { db, lang } = ctx;
		const { s, i } = read(a);
		const cats = Array.isArray(a.categories)
			? (a.categories as unknown[]).filter((c): c is (typeof CATS)[number] =>
					CATS.includes(c as never)
				)
			: [];
		const wd = i('weekday');
		const { data, error } = await db.rpc('find_places', {
			_categories: cats.length ? cats : undefined,
			_crowd: s('crowd') === 'calm' ? 'calm' : undefined,
			_monsoon_ok: a.monsoon_ok === true ? true : undefined,
			_taluka: s('taluka')?.replace(/[%_]/g, '') || undefined,
			_near_slug: s('near') || undefined,
			_max_km: i('max_km'),
			_hidden_gem: a.hidden_gem === true ? true : undefined,
			_tide_free: a.tide_free === true ? true : undefined,
			_weekday: wd != null && wd >= 0 && wd <= 6 ? wd : undefined,
			_limit: i('limit')
		});
		if (error) return { error: 'search failed' };
		return (data ?? []).map((r) => ({
			slug: r.slug,
			name: (lang !== 'en' && r[`name_${lang}`]) || r.name_en,
			category: r.category,
			taluka: r.taluka,
			km: r.km,
			matched: r.matched
		}));
	}
};
