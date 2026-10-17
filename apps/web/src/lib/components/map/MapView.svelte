<script lang="ts" module>
	export type Pin = {
		kind: 'place' | 'stay' | 'eatery';
		id: string;
		slug: string;
		name_en: string | null;
		name_hi: string | null;
		name_mr: string | null;
		category: string | null;
		tide_station_id: string | null;
		lon: number;
		lat: number;
	};
</script>

<script lang="ts">
	import 'maplibre-gl/dist/maplibre-gl.css';
	// Self-contained ES-module worker; Vite emits it as a hashed asset.
	import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
	import { onMount } from 'svelte';
	import type { GeoJSONSource, Map as MLMap, Marker } from 'maplibre-gl';
	import type { FeatureCollection, Point } from 'geojson';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { buildStyle, ATTRIBUTION_OLA, PIN, type MapTheme } from '#lib/map/style.ts';
	import { addPinImages, type UtilityType } from '#lib/map/icons.ts';

	// MapLibre + own PMTiles only (FRONTEND §8). Never requests Ola tiles; Ola appears only as a search marker.
	let {
		tilesBase,
		kinds = [],
		categories = [],
		openNow = false,
		utilities = [],
		olaPoint = null,
		onselect,
		onerror
	}: {
		tilesBase: string;
		kinds?: string[];
		categories?: string[];
		openNow?: boolean;
		utilities?: UtilityType[];
		olaPoint?: { lon: number; lat: number } | null;
		onselect: (pin: Pin | null) => void;
		onerror: () => void;
	} = $props();

	let container: HTMLDivElement;
	let map: MLMap | undefined = $state();
	let ready = $state(false);
	let tilesUrl = '';
	let pins: FeatureCollection = { type: 'FeatureCollection', features: [] };
	let utils: FeatureCollection = { type: 'FeatureCollection', features: [] };
	let marker: Marker | undefined;
	let MarkerCtor: typeof Marker | undefined;

	const theme = (): MapTheme => {
		const t = document.documentElement.dataset.theme;
		if (t === 'light' || t === 'dark') return t;
		return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	};
	const bboxParam = () =>
		map!
			.getBounds()
			.toArray()
			.flat()
			.map((n) => n.toFixed(4))
			.join(',');

	export function flyTo(lon: number, lat: number) {
		map?.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 14) });
	}

	async function overlays() {
		const m = map!;
		await addPinImages(m);
		m.addSource('utilities', { type: 'geojson', data: utils });
		m.addLayer({
			id: 'util',
			type: 'circle',
			source: 'utilities',
			paint: {
				'circle-radius': 11,
				'circle-color': PIN.utility,
				'circle-stroke-width': 1.5,
				'circle-stroke-color': '#FFFFFF'
			}
		});
		m.addLayer({
			id: 'util-icon',
			type: 'symbol',
			source: 'utilities',
			layout: {
				'icon-image': ['concat', 'util-', ['get', 'type']],
				'icon-size': 0.8,
				'icon-allow-overlap': true
			}
		});
		m.addSource('pins', {
			type: 'geojson',
			data: pins,
			cluster: true,
			clusterMaxZoom: 13,
			clusterRadius: 48
		});
		m.addLayer({
			id: 'clusters',
			type: 'circle',
			source: 'pins',
			filter: ['has', 'point_count'],
			paint: {
				'circle-color': PIN.cluster,
				'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 26],
				'circle-stroke-width': 2,
				'circle-stroke-color': '#FFFFFF'
			}
		});
		m.addLayer({
			id: 'cluster-count',
			type: 'symbol',
			source: 'pins',
			filter: ['has', 'point_count'],
			layout: {
				'text-field': ['get', 'point_count_abbreviated'],
				'text-font': ['Mukta SemiBold'],
				'text-size': 14,
				'text-allow-overlap': true
			},
			paint: { 'text-color': '#FFFFFF' }
		});
		m.addLayer({
			id: 'pin',
			type: 'circle',
			source: 'pins',
			filter: ['!', ['has', 'point_count']],
			paint: {
				'circle-radius': 15,
				'circle-color': [
					'match',
					['get', 'kind'],
					'stay',
					PIN.stay,
					'eatery',
					PIN.eatery,
					PIN.place
				],
				'circle-stroke-width': 2,
				'circle-stroke-color': '#FFFFFF'
			}
		});
		m.addLayer({
			id: 'pin-icon',
			type: 'symbol',
			source: 'pins',
			filter: ['!', ['has', 'point_count']],
			layout: {
				'icon-image': [
					'case',
					['==', ['get', 'kind'], 'place'],
					['concat', 'place-', ['get', 'category']],
					['get', 'kind']
				],
				'icon-allow-overlap': true
			}
		});
		ready = true;
	}

	async function loadPins() {
		if (!map || !ready) return;
		const params: Record<string, string> = { bbox: bboxParam() };
		if (kinds.length) params.kinds = kinds.join(',');
		if (categories.length) params.categories = categories.join(',');
		if (openNow) params.open_now = '1';
		const res = await fetch(`/api/map/pins?${new URLSearchParams(params)}`);
		if (!res.ok) return;
		pins = await res.json();
		(map.getSource('pins') as GeoJSONSource | undefined)?.setData(pins);
	}

	async function loadUtilities() {
		if (!map || !ready) return;
		if (!utilities.length) utils = { type: 'FeatureCollection', features: [] };
		else {
			const res = await fetch(
				`/api/map/utilities?bbox=${bboxParam()}&types=${utilities.join(',')}`
			);
			if (!res.ok) return;
			utils = await res.json();
		}
		(map.getSource('utilities') as GeoJSONSource | undefined)?.setData(utils);
	}

	onMount(() => {
		let destroyed = false;
		let protocolCleanup = () => {};
		let timer: ReturnType<typeof setTimeout>;
		const media = matchMedia('(prefers-color-scheme: dark)');
		const restyle = () => {
			ready = false;
			map?.setStyle(buildStyle(tilesUrl, theme(), getLocale(), location.origin));
		};

		(async () => {
			try {
				const [maplibregl, { Protocol, PMTiles }] = await Promise.all([
					import('maplibre-gl'),
					import('pmtiles')
				]);
				const manifest = (await (await fetch(`${tilesBase}/manifest.json`)).json()) as {
					region: string;
				};
				tilesUrl = `${tilesBase}/${manifest.region}`;
				maplibregl.setWorkerUrl(workerUrl);
				const protocol = new Protocol();
				maplibregl.addProtocol('pmtiles', protocol.tile);
				protocolCleanup = () => maplibregl.removeProtocol('pmtiles');
				const archive = new PMTiles(tilesUrl);
				protocol.add(archive);
				const h = await archive.getHeader();
				if (destroyed) return;
				MarkerCtor = maplibregl.Marker;
				const mm = new maplibregl.Map({
					container,
					style: buildStyle(tilesUrl, theme(), getLocale(), location.origin),
					center: [h.centerLon, h.centerLat],
					zoom: Math.max(h.centerZoom, 9),
					minZoom: h.minZoom,
					maxBounds: [
						[h.minLon - 0.2, h.minLat - 0.2],
						[h.maxLon + 0.2, h.maxLat + 0.2]
					],
					attributionControl: { compact: false }
				});
				map = mm;
				mm.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
				mm.addControl(
					new maplibregl.GeolocateControl({ trackUserLocation: false }),
					'bottom-right'
				);
				mm.on('style.load', async () => {
					await overlays();
					loadPins();
					loadUtilities();
				});
				mm.on('moveend', () => {
					clearTimeout(timer);
					timer = setTimeout(() => (loadPins(), loadUtilities()), 250);
				});
				mm.on('click', 'clusters', async (e) => {
					const f = e.features?.[0];
					if (!f) return;
					const src = mm.getSource('pins') as GeoJSONSource;
					const zoom = await src.getClusterExpansionZoom(f.properties.cluster_id);
					mm.easeTo({ center: (f.geometry as Point).coordinates as [number, number], zoom });
				});
				mm.on('click', 'pin', (e) => {
					const f = e.features?.[0];
					if (!f) return;
					const [lon, lat] = (f.geometry as Point).coordinates;
					onselect({ ...(f.properties as Omit<Pin, 'lon' | 'lat'>), lon, lat });
				});
				for (const id of ['pin', 'clusters']) {
					mm.on('mouseenter', id, () => (mm.getCanvas().style.cursor = 'pointer'));
					mm.on('mouseleave', id, () => (mm.getCanvas().style.cursor = ''));
				}
				mm.on('error', (e) => console.warn('map', e.error?.message));
				// Test hook (e2e builds only): centre on a point at street zoom.
				if (import.meta.env.MODE === 'e2e') (window as unknown as { __map: MLMap }).__map = mm;
				if (import.meta.env.MODE === 'e2e')
					addEventListener('e2e:fly', (e) => {
						const {
							lon,
							lat,
							zoom = 16
						} = (e as CustomEvent<{ lon: number; lat: number; zoom?: number }>).detail;
						mm.jumpTo({ center: [lon, lat], zoom });
					});
				media.addEventListener('change', restyle);
			} catch {
				if (!destroyed) onerror();
			}
		})();

		return () => {
			destroyed = true;
			clearTimeout(timer);
			media.removeEventListener('change', restyle);
			map?.remove();
			protocolCleanup();
		};
	});

	// Filters → refetch.
	$effect(() => {
		void [kinds.join(), categories.join(), openNow, ready];
		loadPins();
	});
	$effect(() => {
		void [utilities.join(), ready];
		loadUtilities();
	});

	// Ola search marker: shown with "Ola Maps" attribution only while on screen (BACKEND §6.1).
	$effect(() => {
		if (!map || !ready) return;
		marker?.remove();
		marker = undefined;
		if (map.getSource('ola')) map.removeSource('ola');
		if (olaPoint && MarkerCtor) {
			marker = new MarkerCtor({ color: PIN.cluster })
				.setLngLat([olaPoint.lon, olaPoint.lat])
				.addTo(map);
			map.addSource('ola', {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] },
				attribution: ATTRIBUTION_OLA
			});
		}
	});
</script>

<div bind:this={container} class="h-full w-full" data-testid="map"></div>

<style>
	/* Attribution must always be visible (FRONTEND §8): themed, and lifted clear of the raised Crabby tab. */
	:global(.maplibregl-ctrl-attrib.maplibregl-ctrl) {
		font: 400 12px/16px var(--font-body);
		background: color-mix(in srgb, var(--surface-raised) 90%, transparent);
		color: var(--text-2);
	}
	:global(.maplibregl-ctrl-attrib a) {
		color: var(--link);
	}
	@media (max-width: 1023px) {
		:global(.maplibregl-ctrl-bottom-right),
		:global(.maplibregl-ctrl-bottom-left) {
			margin-bottom: 28px;
		}
	}
</style>
