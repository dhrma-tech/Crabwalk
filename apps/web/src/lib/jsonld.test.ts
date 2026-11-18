import { describe, expect, it } from 'vitest';
import { jsonLdText, listingJsonLd } from './jsonld.ts';

describe('listing JSON-LD (T1-12)', () => {
	it('maps the type, name, image and geo (lon, lat → latitude, longitude)', () => {
		const ld = JSON.parse(
			jsonLdText(
				listingJsonLd({
					type: 'stay',
					name: 'Sea Breeze',
					image: 'https://x.test/a.webp',
					coords: [73.3, 17.0]
				})
			)
		);
		expect(ld).toEqual({
			'@type': 'LodgingBusiness',
			name: 'Sea Breeze',
			image: 'https://x.test/a.webp',
			geo: { '@type': 'GeoCoordinates', latitude: 17, longitude: 73.3 }
		});
		expect(listingJsonLd({ type: 'place', name: 'Fort' })['@type']).toBe('TouristAttraction');
		expect(listingJsonLd({ type: 'eatery', name: 'Kitchen' })['@type']).toBe('Restaurant');
	});

	it('aggregateRating only from 10 counted votes, as the mean 1–4 level', () => {
		expect(
			listingJsonLd({ type: 'place', name: 'F', agg: { counts: [0, 0, 4, 5], total: 9 } })
		).not.toHaveProperty('aggregateRating');
		expect(
			listingJsonLd({ type: 'place', name: 'F', agg: { counts: [1, 2, 3, 4], total: 10 } })
				.aggregateRating
		).toEqual({
			'@type': 'AggregateRating',
			ratingValue: 3,
			ratingCount: 10,
			bestRating: 4,
			worstRating: 1
		});
		expect(
			listingJsonLd({ type: 'stay', name: 'S', agg: { counts: [0, 0, 1, 10], total: 11 } })
				.aggregateRating?.ratingValue
		).toBe(3.9);
	});

	it('escapes < so a name cannot close the script tag', () => {
		const text = jsonLdText(listingJsonLd({ type: 'place', name: '</script><b>x' }));
		expect(text).not.toContain('<');
		expect(JSON.parse(text).name).toBe('</script><b>x');
	});
});
