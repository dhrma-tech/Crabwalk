<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { crabby } from '#lib/crabby.svelte.ts';
	import Crabby from '../Crabby.svelte';
	import CrabbyChat from './CrabbyChat.svelte';

	// Laptops (T-3): Crabby docks on the right under the top bar, collapsible to a kokum button. A viewer's own
	// choice is kept in localStorage; otherwise it starts open on Plan pages and collapsed elsewhere. Phones reach
	// Crabby from the raised nav button, so only the place-page context chips float here (glass pills). Never on
	// Crabby itself, navigation, admin, error pages or while the emergency card is open (FRONTEND §6.7).
	const hidden = $derived(
		page.route.id === '/crabby' ||
			page.route.id === '/navigate' ||
			!!page.route.id?.startsWith('/admin') ||
			crabby.emergency ||
			page.status >= 400
	);
	const place = $derived(
		page.route.id === '/place/[slug]'
			? (page.data as { place?: { names: Record<string, string | null> } }).place
			: undefined
	);
	const placeName = $derived(place ? place.names[getLocale()] || place.names.en : null);
	const chips = $derived(
		placeName
			? [m.crabby_chip_best_time({ place: placeName }), m.crabby_chip_add({ place: placeName })]
			: []
	);

	const KEY = 'crabwalk:dock';
	let chosen = $state<boolean | null>(null);
	onMount(() => {
		try {
			const v = localStorage.getItem(KEY);
			if (v) chosen = v === 'open';
		} catch {
			// Storage blocked (private mode): keep the per-page default.
		}
	});
	const open = $derived(chosen ?? !!page.route.id?.startsWith('/plan'));
	function setOpen(v: boolean) {
		chosen = v;
		try {
			localStorage.setItem(KEY, v ? 'open' : 'closed');
		} catch {
			// Not remembered; still applies for this visit.
		}
	}
</script>

{#if !hidden}
	{#if open}
		<aside
			id="crabby-dock"
			data-dock
			class="fixed top-(--bar-h) right-0 bottom-0 z-panel hidden w-(--dock-w) flex-col bg-surface shadow-e2 lg:flex print:hidden"
			aria-label={m.nav_crabby()}
		>
			<div class="flex items-center gap-2.5 py-3 pr-3 pl-6">
				<Crabby size={32} />
				<h2 class="flex-1 type-h3">{m.nav_crabby()}</h2>
				<button
					type="button"
					class="flex size-11 items-center justify-center rounded-full text-text-2 transition-colors duration-200 hover:bg-surface-2 hover:text-text"
					aria-label={m.close()}
					aria-expanded="true"
					aria-controls="crabby-dock"
					onclick={() => setOpen(false)}><X size={20} aria-hidden="true" /></button
				>
			</div>
			<CrabbyChat {chips} />
		</aside>
	{:else}
		<button
			type="button"
			class="fixed right-6 bottom-6 z-panel hidden size-14 items-center justify-center rounded-full bg-kokum shadow-e2 transition-transform duration-200 hover:scale-105 active:scale-95 lg:flex print:hidden"
			aria-label={m.nav_crabby()}
			aria-expanded="false"
			onclick={() => setOpen(true)}><Crabby size={36} tone="white" /></button
		>
	{/if}
	{#if chips.length}
		<div
			class="fixed right-4 bottom-(--nav-h) z-bar flex flex-col items-end gap-2 lg:hidden print:hidden"
		>
			{#each chips as c (c)}
				<button
					type="button"
					class="glass min-h-11 rounded-full px-4 text-left type-small text-text shadow-e2"
					onclick={() =>
						// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved route + query string
						goto(`${resolve('/crabby')}?ask=${encodeURIComponent(c)}`)}>{c}</button
				>
			{/each}
		</div>
	{/if}
{/if}
