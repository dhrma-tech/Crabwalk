<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import Download from '@lucide/svelte/icons/download';
	import BedDouble from '@lucide/svelte/icons/bed-double';
	import UtensilsCrossed from '@lucide/svelte/icons/utensils-crossed';
	import { PMTILES_BASE_URL } from '$app/env/public';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { onMount, untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import TopBar from '#lib/components/TopBar.svelte';
	import Chip from '#lib/components/Chip.svelte';
	import Button from '#lib/components/Button.svelte';
	import IconButton from '#lib/components/IconButton.svelte';
	import BottomSheet, { type Snap } from '#lib/components/BottomSheet.svelte';
	import ErrorState from '#lib/components/ErrorState.svelte';
	import InsetList from '#lib/components/InsetList.svelte';
	import MiniVerdict from '#lib/components/rating/MiniVerdict.svelte';
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

	// FRONTEND §7 Map (LOCKED order): search + filter chips → layer FAB → tide slider when the tide layer is on →
	// bottom sheet. Tideline (Report 2 §9.3): glass search bar and chips over the map; the layer FAB opens grouped
	// toggles (Show · Services · Live & safety); the pin sheet has photo, name, verdict, actions. Laptops: a
	// 400 px panel (search, filters, pins in view) beside the map, and the sheet becomes a floating card.
	let { data }: PageProps = $props();

	const kindRows = [
		{ k: 'place', label: m.map_places },
		{ k: 'stay', label: m.map_stays },
		{ k: 'eatery', label: m.map_food }
	] as const;
	const catLabel = (c: string) =>
		(m as unknown as Record<string, () => string>)[`cat_${c}`]?.() ?? c;
	const utilLabel = (u: string) => (m as unknown as Record<string, () => string>)[`util_${u}`]();

	let shown = $state<string[]>(['place', 'stay', 'eatery']);
	let categories = $state<string[]>([]);
	let openNow = $state(false);
	let utilities = $state<UtilityType[]>([]);
	// The hand-off pin (?focus=) only seeds the first render.
	const focus = untrack(() => data.focus);
	let selected = $state<Pin | null>(focus);
	let snap = $state<Snap>(focus ? 'half' : 'peek');
	let failed = $state(!PMTILES_BASE_URL);
	let view: MapView | undefined = $state();
	let inView = $state<Pin[]>([]);
	let wide = $state(false);
	let innerHeight = $state(800);
	let layersSnap = $state<Snap>('half');

	// Photo + mini verdict for the selected pin (the hand-off pin arrives with them).
	type Detail = {
		slug: string;
		photo: { src: string; srcset: string; alt: string } | null;
		agg: unknown;
	};
	let detail = $state<Detail | null>(focus as unknown as Detail | null);
	$effect(() => {
		const p = selected;
		if (!p || detail?.slug === p.slug) return;
		detail = null;
		fetch(`/api/map/pin?${new URLSearchParams({ kind: p.kind, slug: p.slug })}`)
			.then((r) => (r.ok ? (r.json() as Promise<Detail>) : null))
			.then((d) => {
				if (d && selected?.slug === p.slug) detail = d;
			})
			.catch(() => {});
	});

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
	// Phones: keep the selected pin above the bottom sheet (peek 132 px, half = 50 %).
	const padBottom = $derived(
		wide || !(selected || feature) || showLayers ? 0 : snap === 'peek' ? 132 : innerHeight * 0.5
	);
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
		const mq = matchMedia('(min-width: 1024px)');
		wide = mq.matches;
		const on = () => (wide = mq.matches);
		mq.addEventListener('change', on);
		return () => mq.removeEventListener('change', on);
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
	function choose(p: Pin) {
		view?.flyTo(p.lon, p.lat);
		selected = p;
		feature = null;
		snap = 'half';
	}

	const pinName = (p: Pin) => {
		const l = getLocale();
		return (l === 'hi' ? p.name_hi : l === 'mr' ? p.name_mr : null) || p.name_en || p.slug;
	};
	const pinSecondary = (p: Pin) => (getLocale() === 'en' ? p.name_mr : p.name_en);
	const gmaps = (p: Pin) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;
	const hrefFor = (p: Pin) =>
		p.kind === 'place'
			? resolve('/place/[slug]', { slug: p.slug })
			: p.kind === 'stay'
				? resolve('/stays/[slug]', { slug: p.slug })
				: resolve('/food/[slug]', { slug: p.slug });
	const kindLabel = (p: Pin) =>
		p.kind === 'place' && p.category
			? catLabel(p.category)
			: p.kind === 'stay'
				? m.kind_stay()
				: m.kind_eatery();
</script>

{#snippet kindIcon(p: Pin)}
	{#if p.kind === 'place' && p.category}<CategoryIcon category={p.category as Category} tile />
	{:else}<span
			class={[
				'flex size-10 shrink-0 items-center justify-center rounded-md',
				p.kind === 'stay' ? 'bg-lagoon-50 text-lagoon-ink' : 'bg-alphonso-50 text-alphonso-ink'
			]}
			>{#if p.kind === 'stay'}<BedDouble size={20} aria-hidden="true" />{:else}<UtensilsCrossed
					size={20}
					aria-hidden="true"
				/>{/if}</span
		>{/if}
{/snippet}

{#snippet pinBody(p: Pin)}
	<div class="flex flex-col gap-3 pb-4" data-testid="pin-sheet">
		<div class="flex items-start gap-3">
			{@render kindIcon(p)}
			<div class="min-w-0 flex-1">
				<h2 class="type-h2">{pinName(p)}</h2>
				<p class="type-small text-text-2">
					{#if pinSecondary(p) && pinSecondary(p) !== pinName(p)}<span
							lang={getLocale() === 'en' ? 'mr' : 'en'}>{pinSecondary(p)}</span
						>
						·
					{/if}{kindLabel(p)}
				</p>
			</div>
			<IconButton label={m.close()} onclick={() => (selected = null)}
				><X size={20} aria-hidden="true" /></IconButton
			>
		</div>
		{#if detail?.slug === p.slug}
			<MiniVerdict type={p.kind} agg={detail.agg as never} />
			{#if detail.photo}<img
					src={detail.photo.src}
					srcset={detail.photo.srcset}
					sizes="360px"
					alt={detail.photo.alt}
					class="aspect-video w-full rounded-md object-cover"
				/>{/if}
		{/if}
		{#if p.tide_station_id}<TideToday station={p.tide_station_id} />{/if}
		<div class="flex flex-wrap gap-2">
			<Button href={hrefFor(p)}>{m.map_open_listing()}</Button>
			<Button variant="secondary" href={gmaps(p)}>{m.map_open_gmaps()}</Button>
		</div>
	</div>
{/snippet}

{#snippet layerToggles()}
	<fieldset class="flex flex-col">
		<legend class="mb-1 type-label text-text-2">{m.layers_show()}</legend>
		{#each kindRows as r (r.k)}
			<label class="flex min-h-11 items-center gap-3 type-body">
				<input
					type="checkbox"
					class="size-5 accent-(--kokum)"
					checked={shown.includes(r.k)}
					onchange={(e) => (shown = toggle(shown, r.k, e.currentTarget.checked))}
				/>{r.label()}
			</label>
		{/each}
	</fieldset>
	<fieldset class="flex flex-col" data-testid="utility-chips">
		<legend class="mb-1 type-label text-text-2">{m.map_utilities()}</legend>
		{#each Object.entries(utilityIcons) as [u, Icon] (u)}
			<label class="flex min-h-11 items-center gap-3 type-body">
				<input
					type="checkbox"
					class="size-5 accent-(--kokum)"
					checked={utilities.includes(u as UtilityType)}
					onchange={(e) =>
						(utilities = toggle(utilities, u as UtilityType, e.currentTarget.checked))}
				/><Icon size={20} aria-hidden="true" class="text-text-2" />{utilLabel(u)}
			</label>
		{/each}
	</fieldset>
	<fieldset class="flex flex-col">
		<legend class="mb-1 type-label text-text-2">{m.layers_live()}</legend>
		{#each layerKeys as k (k)}
			<label class="flex min-h-11 items-center gap-3 type-body">
				<input
					type="checkbox"
					class="size-5 accent-(--kokum)"
					checked={!!layers[k]}
					onchange={(e) => (layers = { ...layers, [k]: e.currentTarget.checked })}
				/>
				{msg(`layer_${k}`)}
			</label>
		{/each}
	</fieldset>
{/snippet}

{#snippet featureBody()}
	<div class="flex flex-col gap-2 pb-4" data-testid="feature-sheet">
		<div class="flex items-start justify-between gap-2">
			{#if feature?.kind === 'alert'}
				<div>
					<h2 class="type-h2">{msg(`alert_${fp('type')}`)}</h2>
					<p class="flex items-center gap-2 type-small font-semibold">
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
			<IconButton label={m.close()} onclick={() => (feature = null)}
				><X size={20} aria-hidden="true" /></IconButton
			>
		</div>
		{#if feature?.kind === 'alert'}
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
{/snippet}

<svelte:window bind:innerHeight />

<Meta title={m.nav_map()} description={m.meta_map()} />

<TopBar title={m.nav_map()} />
<main id="main" class="relative min-h-0 flex-1">
	<h1 class="sr-only">{m.nav_map()}</h1>
	{#if failed}
		<ErrorState title={m.error_title()} body={m.map_unavailable()} />
	{:else}
		<div class="absolute inset-0 lg:left-100">
			<MapView
				bind:this={view}
				tilesBase={PMTILES_BASE_URL!.replace(/\/$/, '')}
				kinds={shown.length === 3 ? [] : shown}
				showPins={shown.length > 0}
				{categories}
				{openNow}
				{utilities}
				{olaPoint}
				{layers}
				{tideMinute}
				initial={data.focus}
				{padBottom}
				heatLabels={{ live: m.heat_live(), typical: m.heat_typical() }}
				onfeature={(x) => ((feature = x), (selected = null), (snap = 'peek'))}
				oninfo={(i) => (layerInfo = i)}
				onpins={(p) => (inView = p)}
				onselect={(p) => ((selected = p), (feature = null), (snap = 'peek'))}
				onerror={() => (failed = true)}
			/>
		</div>

		<!-- Phones: search + chips float over the map. Laptops: the left panel. -->
		<div
			class="pointer-events-none absolute inset-x-0 top-0 z-map-ui flex flex-col gap-2 p-3 lg:pointer-events-auto lg:right-auto lg:bottom-0 lg:w-100 lg:gap-4 lg:overflow-y-auto lg:bg-surface lg:p-5 lg:shadow-e1"
		>
			<div class="pointer-events-auto relative w-full max-w-170">
				<label
					class="glass flex h-12 items-center gap-2 rounded-full px-4 shadow-e2 lg:field lg:rounded-full lg:shadow-none"
				>
					<Search size={20} aria-hidden="true" class="text-text-2" />
					<span class="sr-only">{m.map_search()}</span>
					<input
						bind:value={q}
						oninput={onSearch}
						type="search"
						placeholder={m.map_search()}
						class="h-full min-w-0 flex-1 bg-transparent type-body text-text placeholder:text-muted"
					/>
				</label>
				{#if results.length || searched}
					<ul
						class="absolute inset-x-0 z-panel mt-2 overflow-hidden rounded-lg bg-surface py-1 shadow-e3"
						role="listbox"
					>
						{#each results as r, i (i)}
							<li>
								<button
									type="button"
									class="row-link min-h-11 w-full px-4 py-2.5 text-left type-body"
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

			<div
				class="pointer-events-auto -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
			>
				<Chip glass={!wide} bind:selected={openNow}>{m.map_open_now()}</Chip>
				{#each Object.keys(categoryIcons) as c (c)}
					<Chip
						glass={!wide}
						selected={categories.includes(c)}
						onchange={(on) => (categories = toggle(categories, c, on))}
					>
						<CategoryIcon category={c as Category} size={16} />{catLabel(c)}
					</Chip>
				{/each}
			</div>

			<section class="hidden flex-col gap-3 lg:flex" aria-labelledby="in-view">
				<h2 id="in-view" class="type-label text-text-2">
					{inView.length ? m.map_in_view({ n: inView.length }) : m.map_in_view_none()}
				</h2>
				{#if inView.length}
					<InsetList>
						{#each inView.slice(0, 60) as p (p.kind + p.slug)}
							<button
								type="button"
								class="row-link flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left"
								aria-current={selected?.slug === p.slug ? 'true' : undefined}
								onclick={() => choose(p)}
							>
								{@render kindIcon(p)}
								<span class="flex min-w-0 flex-col">
									<span class="type-body-strong">{pinName(p)}</span>
									<span class="type-small text-text-2">{kindLabel(p)}</span>
								</span>
							</button>
						{/each}
					</InsetList>
				{/if}
			</section>
		</div>

		<!-- Everything that floats over the map itself (right of the laptop panel). -->
		<div class="pointer-events-none absolute inset-0 z-map-ui lg:left-100">
			{#if showLayers && wide}
				<div
					class="pointer-events-auto absolute top-55 right-2 flex max-h-[calc(100%-15rem)] w-72 flex-col gap-4 overflow-y-auto rounded-lg bg-surface p-4 shadow-e3"
					data-testid="layers-panel"
				>
					{@render layerToggles()}
				</div>
			{/if}
			<!-- Next to the MapLibre zoom + locate group: above it on phones (bottom-right, 28 px lift), below it on
			     laptops (top-right). -->
			<button
				type="button"
				class={[
					'pointer-events-auto absolute right-2 bottom-48 flex size-12 items-center justify-center rounded-full shadow-e2 transition-colors duration-200 lg:top-41 lg:bottom-auto',
					showLayers ? 'bg-text text-bg' : 'glass text-text'
				]}
				aria-label={m.layers_title()}
				aria-expanded={showLayers}
				onclick={() => (showLayers = !showLayers)}
				><LayersIcon size={22} aria-hidden="true" /></button
			>

			{#if layers.heat || layers.tides}
				<!-- Solid cards, not glass: they hold text (Report 2 §11). -->
				<div
					class="pointer-events-auto absolute right-16 bottom-[calc(--spacing(20)+env(safe-area-inset-bottom))] left-3 mx-auto flex max-w-130 flex-col gap-2 lg:bottom-6"
				>
					{#if layers.heat && layerInfo}
						<p
							class="rounded-md bg-surface px-3 py-2 type-small shadow-e2"
							data-testid="heat-legend"
						>
							<b>{m.layer_heat()}</b> · {m.heat_counts({
								live: layerInfo.live,
								typical: layerInfo.typical
							})}<br />
							<span class="text-text-2">{m.heat_explain()}</span>
						</p>
					{/if}
					{#if layers.tides}
						<div
							class="flex flex-col gap-1 rounded-md bg-surface px-3 py-2 shadow-e2"
							data-testid="tide-slider"
						>
							<label class="flex items-center gap-3 type-small">
								<span class="w-12 font-semibold" aria-live="polite">{hhmm(tideMinute)}</span>
								<input
									type="range"
									min="0"
									max="1425"
									step="15"
									bind:value={tideMinute}
									class="flex-1 accent-(--lagoon)"
									aria-label={m.tide_slider()}
								/>
							</label>
							<p class="flex flex-wrap gap-x-3 type-small text-text-2">
								<span><span class="text-ok">●</span> {m.tide_ok()}</span>
								<span><span class="text-danger">●</span> {m.tide_cut()}</span>
								<span><span class="text-muted">●</span> {m.tide_unknown()}</span>
								{#each layerInfo?.tideAttribution ?? [] as a (a.url)}
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- provider attribution link -->
									<a href={a.url} target="_blank" rel="noopener">{a.text}</a>
								{/each}
							</p>
						</div>
					{/if}
				</div>
			{/if}

			{#if wide && (selected || feature)}
				<div
					class="pointer-events-auto absolute top-6 left-6 max-h-[calc(100%-3rem)] w-90 overflow-y-auto rounded-xl bg-surface p-4 shadow-e3"
				>
					{#if selected}{@render pinBody(selected)}{:else}{@render featureBody()}{/if}
				</div>
			{/if}
		</div>

		{#if !wide && showLayers}
			<BottomSheet bind:snap={layersSnap}>
				<div class="flex flex-col gap-4 pb-4" data-testid="layers-panel">
					<div class="flex items-center justify-between">
						<h2 class="type-h2">{m.layers_title()}</h2>
						<IconButton label={m.close()} onclick={() => (showLayers = false)}
							><X size={20} aria-hidden="true" /></IconButton
						>
					</div>
					{@render layerToggles()}
				</div>
			</BottomSheet>
		{:else if !wide && feature}
			<BottomSheet bind:snap>{@render featureBody()}</BottomSheet>
		{:else if !wide && selected}
			<BottomSheet bind:snap>{@render pinBody(selected)}</BottomSheet>
		{/if}
	{/if}
</main>
