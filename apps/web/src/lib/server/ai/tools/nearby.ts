import { msg } from '#lib/msg.ts';
import { lonLat, nearby as nearbyListings } from '../../listings.ts';
import { obj, str, placeBySlug, read, type Tool } from './shared.ts';

export const nearbyTool: Tool = {
	def: {
		name: 'nearby',
		description: 'Stays, food and services (fuel, ATM, hospital, toilets…) near a place.',
		parameters: obj({ slug: str('Place slug') }, ['slug'])
	},
	async run(ctx, a) {
		const { db, lang } = ctx;
		const { s } = read(a);
		const p = await placeBySlug(db, s('slug') ?? '');
		const c = p ? lonLat(p.location) : null;
		if (!c) return { found: false };
		const r = await nearbyListings(db, c[0], c[1]);
		return {
			listings: r.listings.map((x) => ({
				kind: x.kind,
				slug: x.slug,
				name: (lang !== 'en' && x[`name_${lang}`]) || x.name_en,
				km: Math.round(x.km * 10) / 10
			})),
			services: r.utilities.map((u) => ({
				type: msg(`util_${u.type}`, {}, lang),
				name: u.name,
				km: Math.round(u.km * 10) / 10
			}))
		};
	}
};
