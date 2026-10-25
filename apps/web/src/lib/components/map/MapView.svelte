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
	import { m as msg } from '#lib/paraglide/messages.js';
	import Crabby from '../Crabby.svelte';
	import type { GeoJSONSource, Map as MLMap, Marker } from 'maplibre-gl';
	import type { FeatureCollection, Point } from 'geojson';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { buildStyle, ATTRIBUTION_OLA, PIN, MAP, type MapTheme } from '#lib/map/style.ts';
	import { addPinImages, type UtilityType } from '#lib/map/icons.ts';
	import { tideState } from '#lib/tides.ts';
	import { offlineData, savedPacks } from '#lib/packs.ts';

	export type Layers = { heat?: boolean; alerts?: boolean; tides?: boolean; trails?: boolean };
	export type LayerInfo = {
		live: number;
		typical: number;
		tideDate: string | null;
		tideAttribution: { text: string; url: string }[];
	};

	// MapLibre + own PMTiles only (FRONTEND §8). Never requests Ola tiles; Ola appears only as a search marker.
	let {
		tilesBase,
		kinds = [],
		categories = [],
		openNow = false,
		utilities = [],
		olaPoint = null,
		showPins = true,
		route = null,
		guide = null,
		me = null,
		follow = false,
		layers = {},
		tideMinute = 0,
		heatLabels = { live: 'Live', typical: 'Typical' },
		onselect,
		onerror,
		onfeature,
		oninfo
	}: {
		tilesBase: string;
		kinds?: string[];
		categories?: string[];
		openNow?: boolean;
		utilities?: UtilityType[];
		olaPoint?: { lon: number; lat: number } | null;
		layers?: Layers;
		tideMinute?: number;
		heatLabels?: { live: string; typical: string };
		onselect: (pin: Pin | null) => void;
		onerror: () => void;
		/** Alert or trail tapped (P9 layers). */
		onfeature?: (f: { kind: 'alert' | 'trail'; props: Record<string, unknown> }) => void;
		oninfo?: (info: LayerInfo) => void;
		/** Navigation (P9): pins off, stored route line, straight guide line, GPS dot, camera follows. */
		showPins?: boolean;
		route?: [number, number][] | null;
		guide?: [number, number][] | null;
		me?: [number, number] | null;
		follow?: boolean;
	} = $props();
	const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
	let tideData: FeatureCollection & { date?: string } = EMPTY;

	let container: HTMLDivElement;
	let map: MLMap | undefined = $state();
	let ready = $state(false);
	// The basemap has drawn once: the loading note can go even if an overlay later fails.
	let painted = $state(false);
	let tilesUrl: string | string[] = '';
	let offline = false;
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
				'circle-stroke-color': MAP.halo
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
				'circle-stroke-color': MAP.halo
			}
		});
		m.addLayer({
			id: 'cluster-count',
			type: 'symbol',
			source: 'pins',
			filter: ['has', 'point_count'],
			layout: {
				'text-field': ['get', 'point_count_abbreviated'],
				'text-font': ['Anek'],
				'text-size': 14,
				'text-allow-overlap': true
			},
			paint: { 'text-color': MAP.halo }
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
				'circle-stroke-color': MAP.halo
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
		// P9 live & safety layers (FRONTEND §8): under the pins, above the basemap.
		m.addSource('heat', { type: 'geojson', data: EMPTY });
		m.addLayer(
			{
				id: 'heat',
				type: 'heatmap',
				source: 'heat',
				maxzoom: 16,
				paint: {
					'heatmap-weight': ['get', 'weight'],
					'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 8, 18, 14, 40],
					'heatmap-opacity': 0.75,
					'heatmap-color': [
						'interpolate',
						['linear'],
						['heatmap-density'],
						0,
						MAP.heat[0],
						0.3,
						MAP.heat[1],
						0.7,
						MAP.heat[2],
						1,
						MAP.heat[3]
					]
				}
			},
			'util'
		);
		// Every point names its source (acceptance: the heatmap labels its data source every time).
		m.addLayer({
			id: 'heat-label',
			type: 'symbol',
			source: 'heat',
			minzoom: 12,
			layout: {
				'text-field': ['match', ['get', 'source'], 'live', heatLabels.live, heatLabels.typical],
				'text-font': ['Anek'],
				'text-size': 12,
				'text-offset': [0, 1.6]
			},
			paint: { 'text-color': MAP.ink, 'text-halo-color': MAP.halo, 'text-halo-width': 1.5 }
		});
		m.addSource('trails', { type: 'geojson', data: EMPTY });
		m.addLayer(
			{
				id: 'trails',
				type: 'line',
				source: 'trails',
				paint: {
					'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 15, 5],
					'line-dasharray': [2, 1.5],
					'line-color': [
						'match',
						['get', 'difficulty'],
						'easy',
						MAP.ok,
						'moderate',
						MAP.caution,
						'hard',
						MAP.danger,
						MAP.unknown
					]
				}
			},
			'util'
		);
		m.addSource('alerts', { type: 'geojson', data: EMPTY });
		const sev = [
			'match',
			['get', 'severity'],
			'danger',
			MAP.danger,
			MAP.caution
		] as unknown as string;
		m.addLayer(
			{
				id: 'alerts-fill',
				type: 'fill',
				source: 'alerts',
				filter: ['==', ['geometry-type'], 'Polygon'],
				paint: { 'fill-color': sev, 'fill-opacity': 0.25 }
			},
			'util'
		);
		m.addLayer(
			{
				id: 'alerts-line',
				type: 'line',
				source: 'alerts',
				filter: ['!=', ['geometry-type'], 'Point'],
				paint: { 'line-color': sev, 'line-width': 5 }
			},
			'util'
		);
		m.addLayer({
			id: 'alerts-point',
			type: 'circle',
			source: 'alerts',
			filter: ['==', ['geometry-type'], 'Point'],
			paint: {
				'circle-radius': 12,
				'circle-color': sev,
				'circle-stroke-width': 3,
				'circle-stroke-color': MAP.halo
			}
		});
		m.addSource('tides', { type: 'geojson', data: EMPTY });
		m.addLayer(
			{
				id: 'tides',
				type: 'circle',
				source: 'tides',
				paint: {
					'circle-radius': 20,
					'circle-color': 'rgba(0,0,0,0)',
					'circle-stroke-width': 4,
					'circle-stroke-color': [
						'match',
						['get', 'state'],
						'ok',
						MAP.ok,
						'cut',
						MAP.caution,
						MAP.unknown
					]
				}
			},
			'pin'
		);
		m.addSource('route', { type: 'geojson', data: EMPTY });
		m.addLayer({
			id: 'route-casing',
			type: 'line',
			source: 'route',
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: { 'line-color': MAP.halo, 'line-width': 10 }
		});
		m.addLayer({
			id: 'route',
			type: 'line',
			source: 'route',
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: {
				'line-color': MAP.route,
				'line-width': 6,
				'line-dasharray': [
					'case',
					['==', ['get', 'guide'], true],
					['literal', [1, 1.5]],
					['literal', [1, 0]]
				]
			}
		});
		m.addSource('me', { type: 'geojson', data: EMPTY });
		m.addLayer({
			id: 'me',
			type: 'circle',
			source: 'me',
			paint: {
				'circle-radius': 9,
				'circle-color': MAP.me,
				'circle-stroke-width': 3,
				'circle-stroke-color': MAP.halo
			}
		});
		for (const id of ['clusters', 'cluster-count', 'pin', 'pin-icon'])
			m.setLayoutProperty(id, 'visibility', showPins ? 'visible' : 'none');
		ready = true;
	}

	const fetchFC = async (path: string) => {
		const res = await fetch(path + '?bbox=' + bboxParam()).catch(() => null);
		return res?.ok ? ((await res.json()) as FeatureCollection & Record<string, unknown>) : EMPTY;
	};
	const setData = (id: string, fc: FeatureCollection) =>
		(map?.getSource(id) as GeoJSONSource | undefined)?.setData(fc);

	function paintTides() {
		if (!map || !ready) return;
		const date = tideData.date ?? '';
		setData('tides', {
			type: 'FeatureCollection',
			features: tideData.features.map((f) => ({
				...f,
				properties: {
					...f.properties,
					state: tideState(
						f.properties?.extremes ?? null,
						f.properties?.max_safe ?? null,
						date,
						tideMinute
					)
				}
			}))
		});
	}

	async function loadLayers() {
		if (!map || !ready) return;
		const [heat, alerts, trails, tides] = await Promise.all([
			layers.heat ? fetchFC('/api/map/heatmap') : EMPTY,
			layers.alerts ? fetchFC('/api/map/alerts') : EMPTY,
			layers.trails ? fetchFC('/api/map/trails') : EMPTY,
			layers.tides ? fetchFC('/api/map/tides') : EMPTY
		]);
		setData('heat', heat);
		setData('alerts', alerts);
		setData('trails', trails);
		tideData = tides as typeof tideData;
		paintTides();
		const live = heat.features.filter((x) => x.properties?.source === 'live').length;
		oninfo?.({
			live,
			typical: heat.features.length - live,
			tideDate: (tides as { date?: string }).date ?? null,
			tideAttribution: (tides as { attribution?: LayerInfo['tideAttribution'] }).attribution ?? []
		});
	}

	async function loadPins() {
		if (!map || !ready || !showPins) return;
		const params: Record<string, string> = { bbox: bboxParam() };
		if (kinds.length) params.kinds = kinds.join(',');
		if (categories.length) params.categories = categories.join(',');
		if (openNow) params.open_now = '1';
		const res = await fetch(`/api/map/pins?${new URLSearchParams(params)}`).catch(() => null);
		if (res?.ok) pins = await res.json();
		else if (offline || !navigator.onLine) pins = await offlinePins();
		else return;
		(map.getSource('pins') as GeoJSONSource | undefined)?.setData(pins);
	}

	/** Pins from downloaded packs (no network). */
	async function offlinePins(): Promise<FeatureCollection> {
		const d = await offlineData();
		const [w, s, e, n] = map!.getBounds().toArray().flat();
		const inBox = (at: [number, number]) =>
			at[0] >= w! && at[0] <= e! && at[1] >= s! && at[1] <= n!;
		const rows = [...d.places, ...d.stays, ...d.eateries].filter(
			(x) =>
				inBox(x.at) &&
				(!kinds.length || kinds.includes(x.kind)) &&
				(!categories.length || (x.kind === 'place' && categories.includes(x.category)))
		);
		return {
			type: 'FeatureCollection',
			features: rows.map((x) => ({
				type: 'Feature',
				geometry: { type: 'Point', coordinates: x.at },
				properties: {
					kind: x.kind,
					id: x.slug,
					slug: x.slug,
					name_en: x.names.en,
					name_hi: x.names.hi,
					name_mr: x.names.mr,
					category: x.kind === 'place' ? x.category : null,
					tide_station_id: null
				}
			}))
		};
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
				maplibregl.setWorkerUrl(workerUrl);
				const protocol = new Protocol();
				maplibregl.addProtocol('pmtiles', protocol.tile);
				protocolCleanup = () => maplibregl.removeProtocol('pmtiles');
				// Online: the region file. Offline (or host unreachable): every downloaded taluka pack (P9).
				let headers;
				try {
					const manifest = (await (await fetch(`${tilesBase}/manifest.json`)).json()) as {
						region: string;
					};
					tilesUrl = `${tilesBase}/${manifest.region}`;
					const archive = new PMTiles(tilesUrl);
					protocol.add(archive);
					headers = [await archive.getHeader()];
				} catch (e) {
					const packs = Object.values(await savedPacks()).map((p) => p.tiles);
					if (!packs.length) throw e;
					offline = true;
					tilesUrl = packs;
					const archives = packs.map((u) => new PMTiles(u));
					archives.forEach((a) => protocol.add(a));
					headers = await Promise.all(archives.map((a) => a.getHeader()));
				}
				const h = {
					minLon: Math.min(...headers.map((x) => x.minLon)),
					minLat: Math.min(...headers.map((x) => x.minLat)),
					maxLon: Math.max(...headers.map((x) => x.maxLon)),
					maxLat: Math.max(...headers.map((x) => x.maxLat)),
					minZoom: Math.min(...headers.map((x) => x.minZoom)),
					centerLon: headers[0]!.centerLon,
					centerLat: headers[0]!.centerLat,
					centerZoom: headers[0]!.centerZoom
				};
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
				mm.once('load', () => (painted = true));
				mm.on('style.load', async () => {
					await overlays();
					loadPins();
					loadUtilities();
				});
				mm.on('moveend', () => {
					clearTimeout(timer);
					timer = setTimeout(() => (loadPins(), loadUtilities(), loadLayers()), 250);
				});
				for (const id of ['alerts-point', 'alerts-line', 'alerts-fill'])
					mm.on('click', id, (e) => {
						const f = e.features?.[0];
						if (f) onfeature?.({ kind: 'alert', props: f.properties as Record<string, unknown> });
					});
				mm.on('click', 'trails', (e) => {
					const f = e.features?.[0];
					if (f) onfeature?.({ kind: 'trail', props: f.properties as Record<string, unknown> });
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
	$effect(() => {
		void [layers.heat, layers.alerts, layers.tides, layers.trails, ready];
		loadLayers();
	});
	$effect(() => {
		void [tideMinute, ready];
		paintTides();
	});

	// Navigation overlays (P9).
	$effect(() => {
		void [route, guide, ready];
		if (!map || !ready) return;
		const line = route ?? guide;
		setData('route', {
			type: 'FeatureCollection',
			features: line
				? [
						{
							type: 'Feature',
							geometry: { type: 'LineString', coordinates: line },
							properties: { guide: !route }
						}
					]
				: []
		});
		if (line && !me) {
			const xs = line.map((p) => p[0]);
			const ys = line.map((p) => p[1]);
			map.fitBounds(
				[
					[Math.min(...xs), Math.min(...ys)],
					[Math.max(...xs), Math.max(...ys)]
				],
				{ padding: 60, duration: 0 }
			);
		}
	});
	$effect(() => {
		void [me, follow, ready];
		if (!map || !ready) return;
		setData('me', {
			type: 'FeatureCollection',
			features: me
				? [{ type: 'Feature', geometry: { type: 'Point', coordinates: me }, properties: {} }]
				: []
		});
		if (me && follow) map.easeTo({ center: me, zoom: Math.max(map.getZoom(), 16), duration: 500 });
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

<div class="relative h-full w-full">
	<div bind:this={container} class="h-full w-full" data-testid="map"></div>
	{#if !painted}
		<!-- The map library is a large download on 4G: say so instead of showing an empty box. -->
		<p
			class="pointer-events-none absolute inset-0 flex items-center justify-center gap-3 bg-bg type-small text-text-2"
			role="status"
		>
			<Crabby size={28} walking />{msg.loading()}
		</p>
	{/if}
</div>

<style>
	/* Attribution must always be visible (FRONTEND §8): themed, and lifted clear of the raised Crabby tab. */
	:global(.maplibregl-ctrl-attrib.maplibregl-ctrl) {
		font: 400 12px/16px var(--font-body);
		background: color-mix(in srgb, var(--surface-raised) 90%, transparent);
		color: var(--text-2);
	}
	/* WCAG 2.5.8 target size + comfortable touch: map control buttons 44 px. Suna: square, hairline, no shadow. */
	:global(.maplibregl-ctrl-group button) {
		width: 44px;
		height: 44px;
	}
	:global(.maplibregl-ctrl.maplibregl-ctrl-group) {
		border-radius: 0;
		box-shadow: none;
		border: 1px solid var(--text);
		background: var(--bg);
	}
	:global(.maplibregl-ctrl-group button + button) {
		border-top-color: var(--border);
	}
	:global([data-theme='dark'] .maplibregl-ctrl-group .maplibregl-ctrl-icon) {
		filter: invert(1);
	}
	@media (prefers-color-scheme: dark) {
		:global(:root:not([data-theme='light']) .maplibregl-ctrl-group .maplibregl-ctrl-icon) {
			filter: invert(1);
		}
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
