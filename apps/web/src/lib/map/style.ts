// Map style (FRONTEND §8, Suna colours per DECISIONS P10a-1): Protomaps basemap layers on washi land and asagi
// water. Labels use our self-hosted Anek text font through MapLibre `font-faces` (Devanagari shaping);
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
		background: '#EAE4D6',
		earth: '#EAE4D6',
		water: '#BFDFE0',
		...parks('#D3E39A'),
		highway: '#FBF9F4',
		major: '#FBF9F4',
		link: '#FBF9F4',
		highway_casing_early: '#D6CFC0',
		highway_casing_late: '#D6CFC0',
		major_casing_early: '#D6CFC0',
		major_casing_late: '#D6CFC0',
		link_casing: '#D6CFC0',
		minor_a: '#F4F0E8',
		minor_b: '#F4F0E8',
		minor_casing: '#D6CFC0',
		city_label: '#1F1E1C',
		city_label_halo: '#EAE4D6',
		subplace_label: '#5C584F',
		subplace_label_halo: '#EAE4D6',
		roads_label_major: '#5C584F',
		roads_label_major_halo: '#F4F0E8',
		roads_label_minor: '#5C584F',
		roads_label_minor_halo: '#F4F0E8',
		state_label: '#5C584F',
		state_label_halo: '#EAE4D6',
		country_label: '#5C584F',
		ocean_label: '#5C584F'
	},
	dark: {
		background: '#202226',
		earth: '#202226',
		water: '#12303A',
		...parks('#2A3A1E'),
		highway: '#3A3D43',
		major: '#3A3D43',
		link: '#3A3D43',
		highway_casing_early: '#2A2C31',
		highway_casing_late: '#2A2C31',
		major_casing_early: '#2A2C31',
		major_casing_late: '#2A2C31',
		link_casing: '#2A2C31',
		minor_a: '#2A2C31',
		minor_b: '#2A2C31',
		minor_casing: '#202226',
		city_label: '#ECE7DB',
		city_label_halo: '#202226',
		subplace_label: '#A39E92',
		subplace_label_halo: '#202226',
		roads_label_major: '#A39E92',
		roads_label_major_halo: '#202226',
		roads_label_minor: '#A39E92',
		roads_label_minor_halo: '#202226',
		state_label: '#A39E92',
		state_label_halo: '#202226',
		country_label: '#A39E92',
		ocean_label: '#A39E92'
	}
};

export const ATTRIBUTION_OSM =
	'<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a> · <a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a>';
export const ATTRIBUTION_OLA =
	'<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">Ola Maps</a>';

/** One region file online, or every downloaded taluka pack offline (P9): same layers per source. */
export function buildStyle(
	tiles: string | string[],
	theme: MapTheme,
	lang: string,
	origin: string
): StyleSpecification {
	const flavor: Flavor = {
		...namedFlavor(theme),
		...flavors[theme],
		regular: 'Anek',
		bold: 'Anek',
		italic: 'Anek',
		pois: undefined // our own pins replace basemap POIs (they would need a sprite sheet)
	};
	// No sprite sheet: drop basemap POIs (our pins replace them) and strip icons from label layers
	// (e.g. the town dot on places_locality) so the labels still draw.
	const urls = Array.isArray(tiles) ? tiles : [tiles];
	// Interleave by layer (all packs' water, then all roads, …) so one pack's land never covers another's roads.
	const per = urls.map((_, i) =>
		sourceLayers(i ? `protomaps${i}` : 'protomaps', i, flavor, lang, theme)
	);
	const base = per[0]!
		.flatMap((_, j) => per.map((ls) => ls[j]!))
		.filter((l, k) => l.type !== 'background' || k === 0);
	return {
		version: 8,
		'font-faces': fontFaces(origin),
		sources: Object.fromEntries(
			urls.map((u, i) => [
				i ? `protomaps${i}` : 'protomaps',
				{ type: 'vector', url: `pmtiles://${u}`, attribution: ATTRIBUTION_OSM }
			])
		),
		layers: base
	} as StyleSpecification;
}

const fontFaces = (origin: string) => {
	// P10-4: Latin + Devanagari halves, chosen by unicode-range (same as app.css). MapLibre draws a font file at
	// its default instance, so every label is Anek 400: one name, no regular/bold pair (T-17).
	const face = (n: string) => [
		{ url: `${origin}/fonts/${n}-latin.woff2`, 'unicode-range': ['U+0020-00FF', 'U+2010-2212'] },
		{
			url: `${origin}/fonts/${n}-deva.woff2`,
			'unicode-range': ['U+0900-097F', 'U+1CD0-1CF9', 'U+200B-200D', 'U+25CC', 'U+A8E0-A8FF']
		}
	];
	return {
		Anek: face('text-var'),
		'Noto Sans Devanagari Regular v1': face('text-var')
	};
};

function sourceLayers(source: string, i: number, flavor: Flavor, lang: string, theme: MapTheme) {
	const base = layers(source, flavor, { lang })
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
		source,
		'source-layer': 'water',
		paint: { 'line-color': theme === 'light' ? '#8FC3C5' : '#1F4A4D', 'line-width': 1 }
	};
	const waterIdx = base.findIndex((l) => l.id === 'water');
	base.splice(waterIdx + 1, 0, coastline);

	return base.map((l) => (i ? ({ ...l, id: `${l.id}-${i}` } as LayerSpecification) : l));
}

// Pin colours (FRONTEND §8 in Suna): places yamabuki, stays asagi, food sakura; utilities neutral grey;
// clusters fuji. Mid-tones that read on both the light and the dark map.
export const PIN = {
	place: '#D99A00',
	stay: '#00808A',
	eatery: '#C45A78',
	utility: '#5C584F',
	cluster: '#6C6BA8'
} as const;

// Overlay colours (Suna): never red — red is emergency only. Halo/casing = washi.
export const MAP = {
	halo: '#F4F0E8',
	ink: '#1F1E1C',
	route: '#2B3F5C',
	me: '#2B3F5C',
	ok: '#7A9A1E',
	caution: '#D99A00',
	danger: '#C45A78',
	unknown: '#8A857A',
	heat: ['rgba(108,107,168,0)', '#6C6BA8', '#D99A00', '#C45A78'] as const
} as const;
