// Hardening T1-12 (UX-09): schema.org data for listing detail pages. `aggregateRating` only with ≥ 10 counted
// votes; the 4-level verdict (1 Skip … 4 Must visit) maps to a 1–4 rating, the mean level.
const TYPE = { place: 'TouristAttraction', stay: 'LodgingBusiness', eatery: 'Restaurant' } as const;
export const MIN_RATED_VOTES = 10;

export function listingJsonLd(l: {
	type: keyof typeof TYPE;
	name: string;
	image?: string | null;
	coords?: [number, number] | null;
	agg?: { counts: number[]; total: number } | null;
}) {
	const { agg, coords } = l;
	const rated = agg && agg.total >= MIN_RATED_VOTES;
	return {
		'@type': TYPE[l.type],
		name: l.name,
		...(l.image ? { image: l.image } : {}),
		...(coords
			? { geo: { '@type': 'GeoCoordinates', latitude: coords[1], longitude: coords[0] } }
			: {}),
		...(rated
			? {
					aggregateRating: {
						'@type': 'AggregateRating',
						ratingValue:
							Math.round((agg.counts.reduce((a, c, i) => a + c * (i + 1), 0) / agg.total) * 10) /
							10,
						ratingCount: agg.total,
						bestRating: 4,
						worstRating: 1
					}
				}
			: {})
	};
}

/** JSON for a `<script type="application/ld+json">` body: `<` escaped so no text can close the tag. */
export const jsonLdText = (v: object) => JSON.stringify(v).replace(/</g, '\\u003c');
