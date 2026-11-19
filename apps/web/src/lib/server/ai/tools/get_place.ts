import { tr } from '../../listings.ts';
import { obj, str, verdictText, today, read, type Tool } from './shared.ts';

export const getPlaceTool: Tool = {
	def: {
		name: 'get_place',
		description:
			'Full verified facts for one place (hours today, fee, best time, how to reach, monsoon, story, dos/donts, safety, rating).',
		parameters: obj({ slug: str('Place slug from search_places') }, ['slug'])
	},
	async run(ctx, a) {
		const { db, lang } = ctx;
		const { s } = read(a);
		const { data: p } = await db
			.from('places')
			.select(
				'id, slug, category, entry_fee_text, entry_fee_inr, best_time_text, how_to_reach_text, nearest_station_text, monsoon_status, monsoon_reason, is_tide_dependent, is_hidden_gem, last_verified_at, verification_method, place_translations(lang, name, short_story, dos, donts, safety_text), place_hours(weekday, opens, closes, hours_unknown), crowd_typical(weekday, level)'
			)
			.eq('slug', s('slug') ?? '')
			.eq('status', 'published')
			.maybeSingle();
		if (!p) return { found: false };
		const { data: v } = await db
			.from('verdict_agg_all')
			.select('winner_level, winner_pct, total')
			.eq('entity_type', 'place')
			.eq('entity_id', p.id)
			.maybeSingle();
		const t = (f: string) => tr(p.place_translations, lang, f as never);
		const h = p.place_hours.find((x) => x.weekday === today());
		return {
			found: true,
			slug: p.slug,
			name: t('name'),
			category: p.category,
			hidden_gem: p.is_hidden_gem,
			hours_today:
				!h || h.hours_unknown
					? 'not known'
					: !h.opens || !h.closes
						? 'closed'
						: `${h.opens.slice(0, 5)}–${h.closes.slice(0, 5)}`,
			crowd_today: p.crowd_typical.find((c) => c.weekday === today())?.level ?? 'not known',
			entry_fee: p.entry_fee_text,
			entry_fee_inr: p.entry_fee_inr,
			best_time: p.best_time_text,
			how_to_reach: p.how_to_reach_text,
			nearest_station: p.nearest_station_text,
			monsoon: p.monsoon_status,
			monsoon_reason: p.monsoon_reason,
			tide_dependent: p.is_tide_dependent,
			story: t('short_story'),
			dos: t('dos'),
			donts: t('donts'),
			safety: t('safety_text'),
			rating: verdictText(
				'place',
				v?.winner_level ?? null,
				v?.winner_pct ?? null,
				v?.total ?? 0,
				lang
			),
			last_verified: p.last_verified_at?.slice(0, 10) ?? null,
			// Desk rows were checked online, not visited (T-48): Crabby must not claim a visit.
			checked: p.verification_method === 'desk' ? 'online' : 'on site',
			link: `/place/${p.slug}`
		};
	}
};
