// Map style (FRONTEND §8, Tideline colours per Report 2 §10, DECISIONS T-26): Protomaps basemap layers. Labels use our self-hosted Anek text font through MapLibre `font-faces` (Devanagari shaping);
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

// Report 2 §10. Minor roads (not in the table) sit between land and major roads.
const flavors: Record<MapTheme, Partial<Flavor>> = {
	light: {
		background: '#F3F0E8',
		earth: '#F3F0E8',
		water: '#CFE6E3',
		...parks('#E2EAD6'),
		highway: '#FFFFFF',
		major: '#FFFFFF',
		link: '#FFFFFF',
		highway_casing_early: '#E4DFD5',
		highway_casing_late: '#E4DFD5',
		major_casing_early: '#E4DFD5',
		major_casing_late: '#E4DFD5',
		link_casing: '#E4DFD5',
		minor_a: '#FBFAF6',
		minor_b: '#FBFAF6',
		minor_casing: '#E4DFD5',
		city_label: '#3A3F45',
		city_label_halo: '#F7F5F0',
		subplace_label: '#3A3F45',
		subplace_label_halo: '#F7F5F0',
		roads_label_major: '#3A3F45',
		roads_label_major_halo: '#F7F5F0',
		roads_label_minor: '#3A3F45',
		roads_label_minor_halo: '#F7F5F0',
		state_label: '#3A3F45',
		state_label_halo: '#F7F5F0',
		country_label: '#3A3F45',
		ocean_label: '#3A3F45'
	},
	dark: {
		background: '#12161A',
		earth: '#12161A',
		water: '#0E2A2C',
		...parks('#17221B'),
		highway: '#232A30',
		major: '#232A30',
		link: '#232A30',
		highway_casing_early: '#2E363D',
		highway_casing_late: '#2E363D',
		major_casing_early: '#2E363D',
		major_casing_late: '#2E363D',
		link_casing: '#2E363D',
		minor_a: '#1B2025',
		minor_b: '#1B2025',
		minor_casing: '#2E363D',
		city_label: '#C9CCD1',
		city_label_halo: '#0F1215',
		subplace_label: '#C9CCD1',
		subplace_label_halo: '#0F1215',
		roads_label_major: '#C9CCD1',
		roads_label_major_halo: '#0F1215',
		roads_label_minor: '#C9CCD1',
		roads_label_minor_halo: '#0F1215',
		state_label: '#C9CCD1',
		state_label_halo: '#0F1215',
		country_label: '#C9CCD1',
		ocean_label: '#C9CCD1'
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
		paint: { 'line-color': theme === 'light' ? '#9CCBC5' : '#1D4A4A', 'line-width': 1 }
	};
	const waterIdx = base.findIndex((l) => l.id === 'water');
	base.splice(waterIdx + 1, 0, coastline);

	return base.map((l) => (i ? ({ ...l, id: `${l.id}-${i}` } as LayerSpecification) : l));
}

/**
 * Overlay colours per theme (Report 2 §10), the light/dark token values from app.css: pins kokum / lagoon /
 * alphonso with their --on-* glyphs, ink clusters (light clusters on the dark map), utilities as surface circles,
 * the lagoon route. Light food pins get an --on-alphonso ring: alphonso on light land is < 3:1 (T-26).
 * Asserted in contrast.test.ts.
 */
export function mapColors(theme: MapTheme) {
	const light = theme === 'light';
	return {
		land: light ? '#F3F0E8' : '#12161A',
		place: light ? '#7A2048' : '#E68AB0',
		placeGlyph: light ? '#FFFFFF' : '#2A0716',
		stay: light ? '#0F6B66' : '#5CC4BB',
		stayGlyph: light ? '#FFFFFF' : '#0F1215',
		eatery: light ? '#F4B740' : '#F6C35E',
		eateryGlyph: light ? '#3D2A00' : '#2E2000',
		ring: light ? '#FFFFFF' : '#0F1215',
		eateryRing: light ? '#3D2A00' : '#0F1215',
		cluster: light ? '#15171A' : '#F2EFE9',
		clusterText: light ? '#FFFFFF' : '#15171A',
		utility: light ? '#FFFFFF' : '#171B1F',
		utilityGlyph: light ? '#4A4F57' : '#B9BCC2',
		utilityRing: light ? '#8F887B' : '#6B7380',
		route: light ? '#0F6B66' : '#5CC4BB',
		routeCasing: light ? '#FFFFFF' : '#0F1215',
		label: light ? '#3A3F45' : '#C9CCD1',
		halo: light ? '#F7F5F0' : '#0F1215',
		ok: light ? '#2F7D4F' : '#7CC69A',
		caution: light ? '#8A5A00' : '#E0B04A',
		danger: light ? '#A8492E' : '#F08E6E',
		unknown: light ? '#646973' : '#8D939B',
		// lagoon-100 (lagoon-50 vanishes on the land colour) → alphonso → laterite.
		heat: light
			? (['rgba(197,229,225,0)', '#C5E5E1', '#F4B740', '#A8492E'] as const)
			: (['rgba(24,61,58,0)', '#183D3A', '#F6C35E', '#F08E6E'] as const)
	};
}
export type MapColors = ReturnType<typeof mapColors>;
