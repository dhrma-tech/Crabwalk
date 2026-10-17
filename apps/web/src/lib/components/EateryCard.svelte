<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { formatINR } from '#lib/format.ts';
	import ListingCard, { type Names, type Photo } from './ListingCard.svelte';

	type Diet = 'veg' | 'nonveg' | 'jain';

	// FRONTEND §6.3 EateryCard. Diet dots always carry a text label.
	let {
		href,
		photo,
		names,
		authenticity,
		signatureDish,
		priceForTwo,
		diet = [],
		saved,
		onsave,
		verdict
	}: {
		href: string;
		photo?: Photo | null;
		names: Names;
		authenticity?: string | null;
		signatureDish?: string | null;
		priceForTwo?: number | null;
		diet?: Diet[];
		saved?: boolean;
		onsave?: () => void;
		verdict?: Snippet;
	} = $props();

	const dot: Record<Diet, string> = {
		veg: 'bg-ok',
		nonveg: 'bg-laterite-700',
		jain: 'bg-mango-700'
	};
	const dietText = { veg: m.diet_veg, nonveg: m.diet_nonveg, jain: m.diet_jain };
</script>

<ListingCard {href} {photo} {names} {saved} {onsave}>
	{#if authenticity}
		<p class="w-fit rounded-chip bg-bg px-2.5 py-0.5 type-tiny text-text-2">{authenticity}</p>
	{/if}
	{#if signatureDish}<p class="type-body">{signatureDish}</p>{/if}
	{#if priceForTwo != null}
		<p class="type-small text-text-2">{m.price_for_two({ price: formatINR(priceForTwo) })}</p>
	{/if}
	{#if diet.length}
		<ul class="flex flex-wrap gap-3 type-small text-text-2">
			{#each diet as d (d)}
				<li class="flex items-center gap-1.5">
					<span class={['size-2.5 rounded-full', dot[d]]} aria-hidden="true"></span>{dietText[d]()}
				</li>
			{/each}
		</ul>
	{/if}
	{@render verdict?.()}
</ListingCard>
