<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { crabby, newChat } from '#lib/crabby.svelte.ts';
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

	// "On this page" chip: Crabby is told the page path (chat.ts), never the page content.
	const SECTION: [string, () => string][] = [
		['/map', m.nav_map],
		['/stays', m.stays_title],
		['/food', m.food_title],
		['/taste-konkan', m.taste_title],
		['/itineraries', m.itin_title],
		['/plan', m.nav_plan],
		['/trip', m.nav_plan],
		['/me', m.nav_me]
	];
	const context = $derived(
		placeName ??
			(page.route.id === '/'
				? m.nav_discover()
				: SECTION.find(([p]) => page.route.id?.startsWith(p))?.[1]()) ??
			null
	);

	// Open: springs up out of the launcher (bottom right); close: shrinks back into it.
	function pop(_: Element, { exit = false } = {}) {
		const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
		return {
			duration: still ? 0 : exit ? 180 : 420,
			easing: exit
				? (t: number) => t * t
				: (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2,
			css: (t: number) =>
				`opacity:${Math.min(1, t * 1.6)};transform:translateY(${(1 - t) * 24}px) scale(${0.9 + 0.1 * t})`
		};
	}

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
			class="fixed top-[calc(var(--bar-h)+8px)] right-3 bottom-3 z-panel hidden w-[calc(var(--dock-w)-24px)] origin-bottom-right flex-col overflow-hidden rounded-[28px] border border-border bg-surface shadow-e3 lg:flex print:hidden"
			aria-label={m.nav_crabby()}
			in:pop
			out:pop={{ exit: true }}
		>
			<div class="relative flex items-center gap-2.5 py-3 pr-2 pl-4">
				<span
					class="flex size-11 shrink-0 items-center justify-center rounded-full bg-kokum-50 ring-1 ring-kokum-100"
					><Crabby size={30} walking={crabby.busy} /></span
				>
				<h2 class="flex-1 type-h3">{m.nav_crabby()}</h2>
				{#if crabby.turns.length}
					<button
						type="button"
						class="min-h-11 rounded-full px-3.5 type-label text-text-2 transition-colors duration-(--dur-state) hover:bg-surface-2 hover:text-text disabled:opacity-50"
						disabled={crabby.busy}
						onclick={newChat}>{m.crabby_new_chat()}</button
					>
				{/if}
				<button
					type="button"
					class="flex size-11 items-center justify-center rounded-full text-text-2 transition-[background-color,color,transform] duration-(--dur-state) hover:rotate-90 hover:bg-surface-2 hover:text-text"
					aria-label={m.close()}
					aria-expanded="true"
					aria-controls="crabby-dock"
					onclick={() => setOpen(false)}><X size={20} aria-hidden="true" /></button
				>
				{#if crabby.busy}
					<span
						class="crabby-sweep absolute inset-x-6 bottom-0 h-0.5 rounded-full"
						aria-hidden="true"
					></span>
				{/if}
			</div>
			{#if context}
				<p
					class="mx-4 mb-1 flex min-h-9 items-center gap-2 rounded-full bg-surface-2 px-3.5 type-small text-text-2"
					data-testid="crabby-context"
				>
					<span class="relative flex size-2 shrink-0" aria-hidden="true"
						><span class="absolute inset-0 animate-ping rounded-full bg-lagoon opacity-60"
						></span><span class="relative size-2 rounded-full bg-lagoon"></span></span
					>{m.crabby_on_page()}<strong class="min-w-0 truncate text-text">{context}</strong>
				</p>
			{/if}
			<CrabbyChat {chips} />
		</aside>
	{:else}
		<button
			type="button"
			class="fixed right-6 bottom-6 z-panel hidden size-14 items-center justify-center rounded-full bg-kokum shadow-e3 ring-4 ring-kokum-100/60 transition-transform duration-(--dur-state) ease-(--ease-spring) hover:scale-110 hover:-rotate-6 active:scale-95 lg:flex print:hidden"
			aria-label={m.nav_crabby()}
			aria-expanded="false"
			onclick={() => setOpen(true)}
			in:pop
			out:pop={{ exit: true }}><Crabby size={36} tone="white" /></button
		>
	{/if}
	{#if chips.length}
		<div
			class="fixed right-4 bottom-[calc(var(--nav-h)+var(--actions-h)+8px)] z-bar flex flex-col items-end gap-2 lg:hidden print:hidden"
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
