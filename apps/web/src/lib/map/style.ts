// Map style (FRONTEND §8 [LOCKED]): Protomaps basemap layers recoloured to "Laterite and sea".
// Labels use our self-hosted Mukta through MapLibre `font-faces` (complex-script shaping for Devanagari);
// no external glyph server, no Ola tiles.
import { layers, namedFlavor, type Flavor } from '@protomaps/basemaps';
import type { StyleSpecification, LayerSpecification } from 'maplibre-gl';

export type MapTheme = 'light' | 'dark';

const parks = (c: string) => ({
	park_a: c,
	park_b: c,
	wood_a: c,
	wood_b: c,
	scrub_a: c,
	scrub_b: c
});

const flavors: Record<MapTheme, Partial<Flavor>> = {
	light: {
		background: '#F6EFE4',
		earth: '#F6EFE4',
		water: '#B3E2DE',
		...parks('#E3E8D4'),
		highway: '#FFFFFF',
		major: '#FFFFFF',
		link: '#FFFFFF',
		highway_casing_early: '#E9DFCF',
		highway_casing_late: '#E9DFCF',
		major_casing_early: '#E9DFCF',
		major_casing_late: '#E9DFCF',
		link_casing: '#E9DFCF',
		minor_a: '#FBF8F2',
		minor_b: '#FBF8F2',
		minor_casing: '#E9DFCF',
		city_label: '#1E1B16',
		city_label_halo: '#F6EFE4',
		subplace_label: '#5A4A35',
		subplace_label_halo: '#F6EFE4',
		roads_label_major: '#5A4A35',
		roads_label_major_halo: '#F6EFE4',
		roads_label_minor: '#5A4A35',
		roads_label_minor_halo: '#F6EFE4',
		state_label: '#5A4A35',
		state_label_halo: '#F6EFE4',
		country_label: '#5A4A35',
		ocean_label: '#0A5350'
	},
	dark: {
		background: '#16120E',
		earth: '#16120E',
		water: '#05302E',
		...parks('#1D2218'), // "darkened" [DEFAULT]
		highway: '#3A3128',
		major: '#3A3128',
		link: '#3A3128',
		highway_casing_early: '#2C251D',
		highway_casing_late: '#2C251D',
		major_casing_early: '#2C251D',
		major_casing_late: '#2C251D',
		link_casing: '#2C251D',
		minor_a: '#2C251D',
		minor_b: '#2C251D',
		minor_casing: '#221C16',
		city_label: '#F3EADC',
		city_label_halo: '#16120E',
		subplace_label: '#C9BBA6',
		subplace_label_halo: '#16120E',
		roads_label_major: '#C9BBA6',
		roads_label_major_halo: '#16120E',
		roads_label_minor: '#C9BBA6',
		roads_label_minor_halo: '#16120E',
		state_label: '#C9BBA6',
		state_label_halo: '#16120E',
		country_label: '#C9BBA6',
		ocean_label: '#6FC1BA'
	}
};

export const ATTRIBUTION_OSM =
	'<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a> · <a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a>';
export const ATTRIBUTION_OLA =
	'<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">Ola Maps</a>';

export function buildStyle(
	tilesUrl: string,
	theme: MapTheme,
	lang: string,
	origin: string
): StyleSpecification {
	const flavor: Flavor = {
		...namedFlavor(theme),
		...flavors[theme],
		regular: 'Mukta Regular',
		bold: 'Mukta SemiBold',
		italic: 'Mukta Regular',
		pois: undefined // our own pins replace basemap POIs (they would need a sprite sheet)
	};
	// No sprite sheet: drop basemap POIs (our pins replace them) and strip icons from label layers
	// (e.g. the town dot on places_locality) so the labels still draw.
	const base = layers('protomaps', flavor, { lang })
		.filter((l) => l.id !== 'pois')
		.map((l) => {
			if (l.type !== 'symbol' || !l.layout || !('icon-image' in l.layout)) return l;
			const layout = Object.fromEntries(
				Object.entries(l.layout).filter(([k]) => !k.startsWith('icon-'))
			);
			return { ...l, layout } as LayerSpecification;
		});
	const coastline: LayerSpecification = {
		id: 'coastline',
		type: 'line',
		source: 'protomaps',
		'source-layer': 'water',
		paint: { 'line-color': theme === 'light' ? '#6FC1BA' : '#0A5350', 'line-width': 1 }
	};
	const waterIdx = base.findIndex((l) => l.id === 'water');
	base.splice(waterIdx + 1, 0, coastline);

	const mukta400 = [{ url: `${origin}/fonts/mukta-400.woff2` }];
	return {
		version: 8,
		'font-faces': {
			'Mukta Regular': mukta400,
			'Mukta SemiBold': [{ url: `${origin}/fonts/mukta-600.woff2` }],
			'Noto Sans Devanagari Regular v1': mukta400
		},
		sources: {
			protomaps: { type: 'vector', url: `pmtiles://${tilesUrl}`, attribution: ATTRIBUTION_OSM }
		},
		layers: base
	} as StyleSpecification;
}

// Pin colours (FRONTEND §8): places laterite, stays sea, food mango; utilities neutral grey.
export const PIN = {
	place: '#B5462B',
	stay: '#0E6E6A',
	eatery: '#E8A33D',
	utility: '#6E6A64',
	cluster: '#0E6E6A'
} as const;
