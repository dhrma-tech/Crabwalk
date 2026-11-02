<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { formatNumber } from '#lib/format.ts';
	import ListingCard, { type Names, type Photo } from './ListingCard.svelte';
	import type { Category } from './CategoryIcon.svelte';

	// FRONTEND §6.3 PlaceCard. `verdict` = mini gauge (P5); `badges` = up to 2 glass StatusBadges over the photo.
	let {
		href,
		photo,
		names,
		category,
		categoryLabel,
		distanceKm,
		saved,
		onsave,
		slug,
		verdict,
		badges
	}: {
		href: string;
		photo?: Photo | null;
		names: Names;
		category: Category;
		categoryLabel: string;
		distanceKm?: number | null;
		saved?: boolean;
		onsave?: () => void;
		/** Turns on the saved-list heart (T-46). */
		slug?: string;
		verdict?: Snippet;
		badges?: Snippet;
	} = $props();
</script>

<ListingCard
	{href}
	{photo}
	{names}
	{category}
	{saved}
	{onsave}
	item={slug ? { type: 'place', slug } : undefined}
	overlay={badges}
>
	<p class="flex flex-wrap items-center gap-x-1.5 type-small text-text-2">
		<span>{categoryLabel}</span>
		{#if distanceKm != null}<span aria-hidden="true">·</span>
			<span>{m.distance_km({ km: formatNumber(distanceKm) })}</span>{/if}
	</p>
	{@render verdict?.()}
</ListingCard>
