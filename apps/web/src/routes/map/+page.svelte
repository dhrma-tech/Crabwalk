<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import Download from '@lucide/svelte/icons/download';
	import { PMTILES_BASE_URL } from '$app/env/public';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import TopBar from '#lib/components/TopBar.svelte';
	import Chip from '#lib/components/Chip.svelte';
	import Button from '#lib/components/Button.svelte';
	import BottomSheet, { type Snap } from '#lib/components/BottomSheet.svelte';
	import ErrorState from '#lib/components/ErrorState.svelte';
	import CategoryIcon, { categoryIcons, type Category } from '#lib/components/CategoryIcon.svelte';
	import MapView, {
		type LayerInfo,
		type Layers,
		type Pin
	} from '#lib/components/map/MapView.svelte';
	import { msg } from '#lib/msg.ts';
	import { relTime } from '#lib/format.ts';
	import TideToday from '#lib/components/map/TideToday.svelte';
	import { utilityIcons, type UtilityType } from '#lib/map/icons.ts';
	import type { PageProps } from './$types';
	import { loginHref } from '#lib/login.ts';
	import Meta from '#lib/components/Meta.svelte';

	let { data }: PageProps = $props();

	const kindChips = [
		{ k: 'place', label: m.map_places },
		{ k: 'stay', label: m.map_stays },
		{ k: 'eatery', label: m.map_food }
	] as const;
	const catLabel = (c: string) =>
		(m as unknown as Record<string, () => string>)[`cat_${c}`]?.() ?? c;
	const utilLabel = (u: string) => (m as unknown as Record<string, () => string>)[`util_${u}`]();

	let kinds = $state<string[]>([]);
	let categories = $state<string[]>([]);
	let openNow = $state(false);
	let showUtilities = $state(false);
	let utilities = $state<UtilityType[]>([]);
	let selected = $state<Pin | null>(null);
	let snap = $state<Snap>('peek');
	let failed = $state(!PMTILES_BASE_URL);
	let view: MapView | undefined = $state();

	// P9 live & safety layers (FRONTEND §8, §6.9, §6.10).
	const istNow = () => {
		const d = new Date(Date.now() + 5.5 * 3600e3);
		return d.getUTCHours() * 60 + d.getUTCMinutes();
	};
	let layers = $state<Layers>({});
	let showLayers = $state(false);
	let tideMinute = $state(istNow());
	let layerInfo = $state<LayerInfo | null>(null);
	let feature = $state<{ kind: 'alert' | 'trail'; props: Record<string, unknown> } | null>(null);
	const hhmm = (m: number) =>
		`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
	const layerKeys = ['heat', 'alerts', 'tides', 'trails'] as const;
	const fp = (k: string) => feature?.props[k] as string | number | null | undefined;

	const toggle = <T,>(list: T[], v: T, on: boolean) =>
		on ? [...list, v] : list.filter((x) => x !== v);

	// Search: own DB first, Ola autocomplete only when nothing matches and the user is signed in (FRONTEND §8).
	type Result = { name: string; lon: number | null; lat: number | null; source: 'own' | 'ola' };
	// ?q= prefills the search (Crabby "open on map" action).
	let q = $state(page.url.searchParams.get('q') ?? '');
	let results = $state<Result[]>([]);
	let searched = $state(false);
	let olaPoint = $state<{ lon: number; lat: number } | null>(null);
	// Device memory only, this session (BACKEND §6.1). Not UI state, so a plain Map.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const olaSessionCache = new Map<string, Result[]>();
	let timer: ReturnType<typeof setTimeout>;

	onMount(() => {
		if (q) onSearch();
	});

	function onSearch() {
		clearTimeout(timer);
		searched = false;
		if (q.trim().length < 2) return void (results = []);
		timer = setTimeout(async () => {
			const term = q.trim();
			const own = await fetch(`/api/map/search?q=${encodeURIComponent(term)}`).then((r) =>
				r.ok ? r.json() : []
			);
			// Dishes have no location (T-24), so the map leaves them out.
			results = (own as { name: string; lon: number | null; lat: number | null }[])
				.filter((r): r is { name: string; lon: number; lat: number } => r.lon != null)
				.map((r) => ({ ...r, source: 'own' as const }));
			if (!results.length && data.signedIn && term.length >= 3) {
				if (!olaSessionCache.has(term)) {
					const ola: {
						results: { description: string; lat: number | null; lng: number | null }[];
					} = await fetch(`/ola/autocomplete?q=${encodeURIComponent(term)}`).then((r) =>
						r.ok ? r.json() : { results: [] }
					);
					olaSessionCache.set(
						term,
						(ola.results as { description: string; lat: number | null; lng: number | null }[]).map(
							(r) => ({
								name: r.description,
								lon: r.lng,
								lat: r.lat,
								source: 'ola' as const
							})
						)
					);
				}
				results = olaSessionCache.get(term)!;
			}
			searched = true;
		}, 400);
	}

	function pick(r: Result) {
		if (r.lon == null || r.lat == null) return;
		olaPoint = r.source === 'ola' ? { lon: r.lon, lat: r.lat } : null;
		view?.flyTo(r.lon, r.lat);
		results = [];
		searched = false;
	}

	const pinName = (p: Pin) => {
		const l = getLocale();
		return (l === 'hi' ? p.name_hi : l === 'mr' ? p.name_mr : null) || p.name_en || p.slug;
	};
	const pinSecondary = (p: Pin) => (getLocale() === 'en' ? p.name_mr : p.name_en);
	const gmaps = (p: Pin) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;
</script>

<Meta title={m.nav_map()} description={m.meta_map()} />

<TopBar title={m.nav_map()} />
<main id="main" class="relative min-h-0 flex-1">
	<h1 class="sr-only">{m.nav_map()}</h1>
	{#if failed}
		<ErrorState title={m.error_title()} body={m.map_unavailable()} />
	{:else}
		<div class="absolute inset-0">
			<MapView
				bind:this={view}
				tilesBase={PMTILES_BASE_URL!.replace(/\/$/, '')}
				{kinds}
				{categories}
				{openNow}
				{utilities}
				{olaPoint}
				{layers}
				{tideMinute}
				heatLabels={{ live: m.heat_live(), typical: m.heat_typical() }}
				onfeature={(x) => ((feature = x), (selected = null), (snap = 'peek'))}
				oninfo={(i) => (layerInfo = i)}
				onselect={(p) => ((selected = p), (feature = null), (snap = 'peek'))}
				onerror={() => (failed = true)}
			/>
		</div>

		<div
			class="pointer-events-none absolute inset-x-0 top-0 z-map-ui flex flex-col gap-2 p-3 lg:px-10 lg:pt-5"
		>
			<div class="pointer-events-auto relative w-full max-w-[680px] lg:max-w-[360px]">
				<label class="flex h-12 items-center gap-2 border border-border bg-bg px-3">
					<Search size={20} aria-hidden="true" class="text-text-2" />
					<span class="sr-only">{m.map_search()}</span>
					<input
						bind:value={q}
						oninput={onSearch}
						type="search"
						placeholder={m.map_search()}
						class="h-full min-w-0 flex-1 bg-transparent type-body text-text placeholder:text-text-2"
					/>
				</label>
				{#if results.length || searched}
					<ul class="mt-1 overflow-hidden border border-text bg-bg" role="listbox">
						{#each results as r, i (i)}
							<li>
								<button
									type="button"
									class="w-full px-4 py-3 text-left type-body"
									onclick={() => pick(r)}>{r.name}</button
								>
							</li>
						{/each}
						{#if searched && !results.length}
							<li class="px-4 py-3 type-small text-text-2">
								{#if !data.signedIn && q.trim().length >= 3}
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- /login + a validated return path -->
									<a href={loginHref(page.url)}>{m.map_search_more_signin()}</a>
								{:else}
									{m.map_no_results()}
								{/if}
							</li>
						{/if}
						{#if results[0]?.source === 'ola'}
							<li class="border-t border-border px-4 py-2 type-small text-text-2">
								{m.map_from_ola()} ·
								<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener"
									>Ola Maps</a
								>
							</li>
						{/if}
					</ul>
				{/if}
			</div>

			<div class="pointer-events-auto -mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
				{#each kindChips as c (c.k)}
					<Chip selected={kinds.includes(c.k)} onchange={(on) => (kinds = toggle(kinds, c.k, on))}
						>{c.label()}</Chip
					>
				{/each}
				<Chip bind:selected={openNow}>{m.map_open_now()}</Chip>
				<Chip bind:selected={showUtilities}>{m.map_utilities()}</Chip>
				{#each Object.keys(categoryIcons) as c (c)}
					<Chip
						selected={categories.includes(c)}
						onchange={(on) => (categories = toggle(categories, c, on))}
					>
						<CategoryIcon category={c as Category} size={16} />{catLabel(c)}
					</Chip>
				{/each}
			</div>

			{#if showUtilities}
				<div
					class="pointer-events-auto -mx-3 flex gap-2 overflow-x-auto px-3 pb-1"
					data-testid="utility-chips"
				>
					{#each Object.entries(utilityIcons) as [u, Icon] (u)}
						<Chip
							selected={utilities.includes(u as UtilityType)}
							onchange={(on) => (utilities = toggle(utilities, u as UtilityType, on))}
						>
							<Icon size={16} aria-hidden="true" />{utilLabel(u)}
						</Chip>
					{/each}
				</div>
			{/if}
		</div>

		<div
			class="absolute left-3 bottom-[calc(140px+env(safe-area-inset-bottom))] z-map-ui flex flex-col items-start gap-2 lg:bottom-28"
		>
			{#if showLayers}
				<fieldset
					class="flex flex-col gap-1 border border-text bg-bg p-3"
					data-testid="layers-panel"
				>
					<legend class="sr-only">{m.layers_title()}</legend>
					{#each layerKeys as k (k)}
						<label class="flex min-h-11 items-center gap-3 type-body">
							<input
								type="checkbox"
								class="size-5"
								checked={!!layers[k]}
								onchange={(e) => (layers = { ...layers, [k]: e.currentTarget.checked })}
							/>
							{msg(`layer_${k}`)}
						</label>
					{/each}
				</fieldset>
			{/if}
			<button
				type="button"
				class="flex size-12 items-center justify-center border border-text bg-bg"
				aria-label={m.layers_title()}
				aria-expanded={showLayers}
				onclick={() => (showLayers = !showLayers)}
				><LayersIcon size={22} aria-hidden="true" /></button
			>
		</div>

		{#if layers.heat || layers.tides}
			<div
				class="pointer-events-auto absolute inset-x-3 bottom-[calc(80px+env(safe-area-inset-bottom))] z-map-ui mx-auto flex max-w-[520px] flex-col gap-2 lg:bottom-6"
			>
				{#if layers.heat && layerInfo}
					<p class="border border-border bg-bg px-3 py-2 type-small" data-testid="heat-legend">
						<b>{m.layer_heat()}</b> · {m.heat_counts({
							live: layerInfo.live,
							typical: layerInfo.typical
						})}<br />
						<span class="text-text-2">{m.heat_explain()}</span>
					</p>
				{/if}
				{#if layers.tides}
					<div
						class="flex flex-col gap-1 border border-border bg-bg px-3 py-2"
						data-testid="tide-slider"
					>
						<label class="flex items-center gap-3 type-small">
							<span class="w-12 font-medium" aria-live="polite">{hhmm(tideMinute)}</span>
							<input
								type="range"
								min="0"
								max="1425"
								step="15"
								bind:value={tideMinute}
								class="flex-1 accent-[var(--cta)]"
								aria-label={m.tide_slider()}
							/>
						</label>
						<p class="flex flex-wrap gap-x-3 type-small text-text-2">
							<span><span class="text-ok">●</span> {m.tide_ok()}</span>
							<span><span class="text-caution">●</span> {m.tide_cut()}</span>
							<span><span class="text-text-2">●</span> {m.tide_unknown()}</span>
							{#each layerInfo?.tideAttribution ?? [] as a (a.url)}
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- provider attribution link -->
								<a href={a.url} target="_blank" rel="noopener">{a.text}</a>
							{/each}
						</p>
					</div>
				{/if}
			</div>
		{/if}

		{#if feature}
			<BottomSheet bind:snap>
				<div class="flex flex-col gap-2 pb-4" data-testid="feature-sheet">
					<div class="flex items-start justify-between gap-2">
						{#if feature.kind === 'alert'}
							<div>
								<h2 class="type-h2">{msg(`alert_${fp('type')}`)}</h2>
								<p class="flex items-center gap-2 type-small font-medium">
									<span
										class={[
											'size-2 rounded-full',
											fp('severity') === 'danger' ? 'bg-danger' : 'bg-caution'
										]}
										aria-hidden="true"
									></span>{msg(`severity_${fp('severity')}`)}
								</p>
							</div>
						{:else}
							<div>
								<h2 class="type-h2">{fp(`name_${getLocale()}`) || fp('name_en')}</h2>
								<p class="type-small text-text-2">
									{m.km_away({ km: String(fp('km')) })} · {fp('difficulty')
										? msg(`trail_${fp('difficulty')}`)
										: m.trail_unrated()}
								</p>
							</div>
						{/if}
						<button
							type="button"
							class="flex size-11 items-center justify-center text-text-2"
							aria-label={m.close()}
							onclick={() => (feature = null)}><X size={20} aria-hidden="true" /></button
						>
					</div>
					{#if feature.kind === 'alert'}
						{@const reason = fp(`reason_${getLocale()}`) || fp('reason_en')}
						{#if reason}<p class="type-body">{reason}</p>{/if}
						<p class="type-small text-text-2" data-testid="alert-times">
							{m.alert_times({
								ago: relTime(String(fp('reported_at')), getLocale()),
								left: relTime(String(fp('expires_at')), getLocale())
							})}
						</p>
					{:else}
						{#if fp('difficulty')}<p class="type-small">
								{msg(`trail_${fp('difficulty')}_def`)}
							</p>{/if}
						<p class="type-small text-text-2">
							{fp('source') === 'osm' ? m.trail_source_osm() : m.trail_source_team()}
						</p>
						<div>
							<Button variant="secondary" href={`/api/trails/${fp('id')}/gpx`}>
								{#snippet icon()}<Download size={18} aria-hidden="true" />{/snippet}
								{m.trail_gpx()}
							</Button>
						</div>
					{/if}
				</div>
			</BottomSheet>
		{/if}

		{#if selected}
			{@const p = selected}
			<BottomSheet bind:snap>
				<div class="flex flex-col gap-3 pb-4" data-testid="pin-sheet">
					<div class="flex items-start gap-2">
						<div class="min-w-0 flex-1">
							<h2 class="type-h2">{pinName(p)}</h2>
							{#if pinSecondary(p) && pinSecondary(p) !== pinName(p)}
								<p class="type-small text-text-2" lang={getLocale() === 'en' ? 'mr' : 'en'}>
									{pinSecondary(p)}
								</p>
							{/if}
							<p class="mt-1 flex items-center gap-1.5 type-small text-text-2">
								{#if p.kind === 'place' && p.category}
									<CategoryIcon category={p.category as Category} size={16} />{catLabel(p.category)}
								{:else}
									{p.kind === 'stay' ? m.kind_stay() : m.kind_eatery()}
								{/if}
							</p>
						</div>
						<button
							type="button"
							class="flex size-11 items-center justify-center text-text-2"
							aria-label={m.close()}
							onclick={() => (selected = null)}><X size={20} aria-hidden="true" /></button
						>
					</div>
					{#if p.tide_station_id}<TideToday station={p.tide_station_id} />{/if}
					<div><Button variant="secondary" href={gmaps(p)}>{m.map_open_gmaps()}</Button></div>
				</div>
			</BottomSheet>
		{/if}
	{/if}
</main>
