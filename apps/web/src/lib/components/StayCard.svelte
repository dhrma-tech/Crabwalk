<script lang="ts">
	import type { Snippet } from 'svelte';
	import HouseHeart from '@lucide/svelte/icons/house-heart';
	import ConciergeBell from '@lucide/svelte/icons/concierge-bell';
	import { m } from '#lib/paraglide/messages.js';
	import { formatINRRange } from '#lib/format.ts';
	import ListingCard, { type Names, type Photo } from './ListingCard.svelte';
	import TagList from './TagList.svelte';

	// FRONTEND §6.3 StayCard. Price row always shows its source (§13).
	let {
		href,
		photo,
		names,
		tags = [],
		priceMin,
		priceMax,
		priceSource,
		serviceStyle,
		row,
		level,
		saved,
		onsave,
		verdict
	}: {
		href: string;
		photo?: Photo | null;
		names: Names;
		tags?: string[];
		priceMin?: number | null;
		priceMax?: number | null;
		priceSource?: string | null;
		serviceStyle?: 'homely' | 'professional' | null;
		row?: boolean;
		level?: 2 | 3;
		saved?: boolean;
		onsave?: () => void;
		verdict?: Snippet;
	} = $props();
</script>

<ListingCard {href} {photo} {names} tone="asagi" {row} {level} {saved} {onsave}>
	{#if tags.length}<TagList {tags} />{/if}
	{#if priceMin != null && priceMax != null && priceSource}
		<p class="type-small text-text-2">
			{m.price_from({ range: formatINRRange(priceMin, priceMax), source: priceSource })}
		</p>
	{/if}
	{@render verdict?.()}
	{#if serviceStyle}
		<p class="flex items-center gap-1.5 type-small text-text-2">
			{#if serviceStyle === 'homely'}
				<HouseHeart size={20} aria-hidden="true" />{m.service_homely()}
			{:else}
				<ConciergeBell size={20} aria-hidden="true" />{m.service_professional()}
			{/if}
		</p>
	{/if}
</ListingCard>
