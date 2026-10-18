<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import { PMTILES_BASE_URL } from '$app/env/public';
	import { resolve } from '$app/paths';
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
	import MapView, { type Pin } from '#lib/components/map/MapView.svelte';
	import TideToday from '#lib/components/map/TideToday.svelte';
	import { utilityIcons, type UtilityType } from '#lib/map/icons.ts';
	import type { PageProps } from './$types';

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
			results = (own as { name: string; lon: number; lat: number }[]).map((r) => ({
				...r,
				source: 'own' as const
			}));
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

<svelte:head><title>{m.nav_map()} · {m.app_name()}</title></svelte:head>

<TopBar title={m.nav_map()} />
<main id="main" class="relative min-h-0 flex-1">
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
				onselect={(p) => ((selected = p), (snap = 'peek'))}
				onerror={() => (failed = true)}
			/>
		</div>

		<div class="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3">
			<div class="pointer-events-auto relative mx-auto w-full max-w-[680px]">
				<label
					class="flex h-12 items-center gap-2 rounded-input border border-border bg-raised px-3 shadow-float"
				>
					<Search size={20} aria-hidden="true" class="text-text-2" />
					<span class="sr-only">{m.map_search()}</span>
					<input
						bind:value={q}
						oninput={onSearch}
						type="search"
						placeholder={m.map_search()}
						class="h-full min-w-0 flex-1 bg-transparent type-body text-text outline-none"
					/>
				</label>
				{#if results.length || searched}
					<ul
						class="mt-1 overflow-hidden rounded-card border border-border bg-raised shadow-float"
						role="listbox"
					>
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
									<a href={resolve('/login')}>{m.map_search_more_signin()}</a>
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
							class="flex size-11 items-center justify-center rounded-chip text-text-2"
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
