// Stay price comparison rows (BACKEND §13 / FRONTEND §7.5). Every row names its source; never scraped.
import { m } from '#lib/paraglide/messages.js';
import { formatINR, formatINRRange } from '#lib/format.ts';
import type { PriceRow } from '#lib/components/listing/PriceTable.svelte';
import { agodaLivePrice } from './agoda.ts';

const NETWORK: Record<string, string> = {
	agoda_partners: 'Agoda Partners',
	inrdeals: 'INRDeals',
	cuelinks: 'Cuelinks'
};
const FRESH_MS = 24 * 3600e3;

type Stay = {
	id: string;
	price_min: number | null;
	price_max: number | null;
	stay_offers: {
		provider: string;
		deep_link: string;
		affiliate_network: string | null;
		live_price: number | null;
		fetched_at: string | null;
	}[];
};

export async function priceRows(s: Stay): Promise<PriceRow[]> {
	const rows: PriceRow[] = [];
	if (s.price_min != null && s.price_max != null)
		rows.push({
			label: m.price_owner(),
			price: formatINRRange(s.price_min, s.price_max),
			source: m.source_owner()
		});
	for (const o of s.stay_offers) {
		const live = o.provider === 'agoda' ? await agodaLivePrice() : null;
		const stored =
			o.live_price != null && o.fetched_at && Date.now() - Date.parse(o.fetched_at) < FRESH_MS
				? o.live_price
				: null;
		const price = live?.price ?? stored;
		rows.push({
			label: o.provider.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
			price: price != null ? formatINR(price) : null,
			source: live ? m.source_agoda_live() : (NETWORK[o.affiliate_network ?? ''] ?? o.provider),
			href: o.deep_link
		});
	}
	return rows;
}
