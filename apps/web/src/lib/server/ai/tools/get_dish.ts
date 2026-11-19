import { getDish, tr } from '../../listings.ts';
import { obj, str, n, read, type Tool } from './shared.ts';

export const getDishTool: Tool = {
	def: {
		name: 'get_dish',
		description: 'A Konkan dish: what it is, its story, where it is best.',
		parameters: obj({ slug: str('Dish slug') }, ['slug'])
	},
	async run(ctx, a) {
		const { db, lang } = ctx;
		const { s } = read(a);
		const d = await getDish(db, s('slug') ?? '');
		if (!d) return { found: false };
		return {
			found: true,
			// T2-03: a reply naming the dish cites this slug.
			slug: d.slug,
			name: tr(d.dish_translations, lang),
			what_it_is: tr(d.dish_translations, lang, 'what_it_is'),
			story: tr(d.dish_translations, lang, 'story'),
			best_at: d.eatery_dishes.map((e) => ({
				name: n(e.eateries?.eatery_translations, lang),
				slug: e.eateries?.slug
			}))
		};
	}
};
