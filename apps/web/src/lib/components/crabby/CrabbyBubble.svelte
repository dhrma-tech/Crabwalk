<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { crabby } from '#lib/crabby.svelte.ts';
	import Crabby from '../Crabby.svelte';
	import CrabbyChat from './CrabbyChat.svelte';

	// Suna 5a (DECISIONS P10a-4): laptops dock Crabby on the right on every page; phones reach Crabby from the
	// raised nav button, so only the place-page context chips float here. Never on Crabby itself,
	// navigation, admin, error pages or while the emergency card is open (FRONTEND §6.7).
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
</script>

{#if !hidden}
	<aside
		data-dock
		class="fixed inset-y-0 right-0 z-panel hidden w-[340px] flex-col border-l border-border bg-bg lg:flex print:hidden"
		aria-label={m.nav_crabby()}
	>
		<h2 class="flex items-center gap-2.5 px-6 pt-6 pb-2 type-h3">
			<Crabby size={30} />{m.nav_crabby()}
		</h2>
		<CrabbyChat {chips} />
	</aside>
	{#if chips.length}
		<div
			class="fixed right-6 bottom-[calc(80px+env(safe-area-inset-bottom))] z-bar flex flex-col items-end gap-2 lg:hidden print:hidden"
		>
			{#each chips as c (c)}
				<button
					type="button"
					class="min-h-11 border border-text bg-bg px-4 text-left type-small"
					onclick={() =>
						// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved route + query string
						goto(`${resolve('/crabby')}?ask=${encodeURIComponent(c)}`)}>{c}</button
				>
			{/each}
		</div>
	{/if}
{/if}
