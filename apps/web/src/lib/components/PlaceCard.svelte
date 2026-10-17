<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { formatNumber } from '#lib/format.ts';
	import ListingCard, { type Names, type Photo } from './ListingCard.svelte';
	import CategoryIcon, { type Category } from './CategoryIcon.svelte';

	// FRONTEND §6.3 PlaceCard. `verdict` = mini gauge (P5); `badges` = up to 2 StatusBadges.
	let {
		href,
		photo,
		names,
		category,
		categoryLabel,
		distanceKm,
		saved,
		onsave,
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
		verdict?: Snippet;
		badges?: Snippet;
	} = $props();
</script>

<ListingCard {href} {photo} {names} fallbackCategory={category} {saved} {onsave}>
	<p class="flex items-center gap-1.5 type-small text-text-2">
		<CategoryIcon {category} size={20} />
		<span>{categoryLabel}</span>
		{#if distanceKm != null}<span aria-hidden="true">·</span>
			<span>{m.distance_km({ km: formatNumber(distanceKm) })}</span>{/if}
	</p>
	{@render verdict?.()}
	{#if badges}<div class="flex flex-wrap gap-1.5">{@render badges()}</div>{/if}
</ListingCard>
