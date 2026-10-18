<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { ask, crabby } from '#lib/crabby.svelte.ts';
	import Crabby from '../Crabby.svelte';
	import CrabbyChat from './CrabbyChat.svelte';

	// FRONTEND §4/§6.7: floating bubble above the nav on every page (not on Crabby itself, admin, or while
	// the emergency card is open). Place pages get context chips. Desktop opens a right-side panel.
	let open = $state(false);
	const hidden = $derived(
		page.route.id === '/crabby' ||
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

	function toggle() {
		if (window.matchMedia('(min-width: 1024px)').matches) open = !open;
		else goto(resolve('/crabby'));
	}
	function chip(c: string) {
		if (window.matchMedia('(min-width: 1024px)').matches) {
			open = true;
			ask(c);
		} else {
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved route + query string
			goto(`${resolve('/crabby')}?ask=${encodeURIComponent(c)}`);
		}
	}
</script>

{#if !hidden}
	{#if open}
		<aside
			class="fixed inset-y-0 right-0 z-30 hidden w-[400px] flex-col border-l border-border bg-bg shadow-float lg:flex print:hidden"
			aria-label={m.nav_crabby()}
		>
			<div class="flex items-center justify-between border-b border-border px-4 py-2">
				<h2 class="type-h3">{m.nav_crabby()}</h2>
				<button
					type="button"
					class="flex size-11 items-center justify-center"
					aria-label={m.close()}
					onclick={() => (open = false)}><X size={22} aria-hidden="true" /></button
				>
			</div>
			<CrabbyChat {chips} />
		</aside>
	{:else}
		<div
			class="fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 flex flex-col items-end gap-2 lg:bottom-6 print:hidden"
		>
			{#if chips.length}
				{#each chips as c (c)}
					<button
						type="button"
						class="min-h-11 rounded-chip border border-border bg-raised px-4 type-small shadow-float"
						onclick={() => chip(c)}>{c}</button
					>
				{/each}
			{/if}
			<button
				type="button"
				class="flex size-14 items-center justify-center rounded-full border border-border bg-raised shadow-float"
				aria-label={m.crabby_open()}
				data-testid="crabby-bubble"
				onclick={toggle}><Crabby size={40} /></button
			>
		</div>
	{/if}
{/if}
