import { msg } from '#lib/msg.ts';
import {
	obj,
	str,
	int,
	n,
	placeBySlug,
	listingBySlug,
	propose,
	read,
	type ActionType,
	type Tool
} from './shared.ts';

export const proposeActionTool: Tool = {
	def: {
		name: 'propose_action',
		description:
			'Offer a one-tap action the user confirms: open_map (place), start_nav (place), shortlist_stays (stay slugs), save_share (trip ref), add_to_trip (listing_type + slug, trip ref, day).',
		parameters: obj(
			{
				type: str('type', {
					enum: ['open_map', 'start_nav', 'shortlist_stays', 'save_share', 'add_to_trip']
				}),
				place: str('Place slug'),
				stays: { type: 'array', items: str('Stay slug') },
				trip: str('Trip ref'),
				listing_type: str('add_to_trip: what to add', { enum: ['place', 'stay', 'eatery'] }),
				slug: str('add_to_trip: listing slug'),
				day: int('add_to_trip: day number (1…)')
			},
			['type']
		)
	},
	async run(ctx, a) {
		const { db, lang } = ctx;
		const { s, i } = read(a);
		const type = s('type') as ActionType;
		if (type === 'open_map' || type === 'start_nav') {
			const p = await placeBySlug(db, s('place') ?? '');
			if (!p) return { error: 'place not found' };
			const nm = n(p.place_translations, lang) ?? p.slug;
			return propose(ctx, type, { title: nm, lines: [] }, { slug: p.slug, name: nm });
		}
		if (type === 'shortlist_stays') {
			const slugs = Array.isArray(a.stays) ? (a.stays as string[]).slice(0, 5) : [];
			const { data } = await db
				.from('stays')
				.select('slug, price_min, stay_translations(lang, name), stay_offers(provider, deep_link)')
				.in('slug', slugs)
				.eq('status', 'published');
			if (!data?.length) return { error: 'no stays found' };
			return propose(
				ctx,
				type,
				{
					title: msg('ai_shortlist', {}, lang),
					lines: data.map(
						(x) => `${n(x.stay_translations, lang)}${x.price_min ? ` · ₹${x.price_min}+` : ''}`
					),
					links: data.flatMap((x) => [
						{ label: n(x.stay_translations, lang) ?? x.slug, href: `/stays/${x.slug}` },
						...x.stay_offers.slice(0, 1).map((o) => ({
							label: `${n(x.stay_translations, lang)} · ${o.provider}`,
							href: o.deep_link
						}))
					])
				},
				{ slugs: data.map((x) => x.slug) }
			);
		}
		if (type === 'save_share') {
			const id = ctx.trips.get(s('trip') ?? '');
			if (!id) return { error: 'unknown trip ref — call list_my_trips first' };
			const { data: t } = await db.from('trips').select('title').eq('id', id).maybeSingle();
			return propose(ctx, type, { title: t?.title ?? '', lines: [] }, { trip_id: id });
		}
		if (type === 'add_to_trip') {
			const id = ctx.trips.get(s('trip') ?? '');
			if (!id) return { error: 'unknown trip ref — call list_my_trips first' };
			const kind = s('listing_type') ?? 'place';
			if (kind !== 'place' && kind !== 'stay' && kind !== 'eatery')
				return { error: 'bad listing type' };
			const l = await listingBySlug(db, kind, s('slug') ?? '');
			const { data: t } = await db.from('trips').select('title, days').eq('id', id).maybeSingle();
			if (!l || !t) return { error: 'listing or trip not found' };
			const day = Math.min(Math.max(i('day') ?? 1, 1), t.days);
			const name = n(l.names, lang) ?? l.slug;
			return propose(
				ctx,
				type,
				{ title: t.title, lines: [`+ ${name} · ${msg('plan_day_n', { n: day }, lang)}`] },
				{ trip_id: id, type: kind, entity_id: l.id, day }
			);
		}
		return { error: 'unknown action type' };
	}
};
