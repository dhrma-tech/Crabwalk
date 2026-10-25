<script lang="ts" module>
	import BedDouble from '@lucide/svelte/icons/bed-double';
	import UtensilsCrossed from '@lucide/svelte/icons/utensils-crossed';
	import Soup from '@lucide/svelte/icons/soup';
	import WavesIcon from '@lucide/svelte/icons/waves';
	import {
		categoryFamily,
		categoryIcons,
		familyTint,
		type Category,
		type Family
	} from './CategoryIcon.svelte';

	export type Kind = 'stay' | 'eatery' | 'dish';
	// Listings that aren't places borrow the family tint they had in Suna (DECISIONS T-22).
	const kinds = {
		stay: { icon: BedDouble, family: 'coast' },
		eatery: { icon: UtensilsCrossed, family: 'land' },
		dish: { icon: Soup, family: 'heritage' }
	} as const satisfies Record<Kind, { icon: unknown; family: Family }>;
</script>

<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';

	// No stock photos (CLAUDE.md §2). A designed card, not a placeholder (Report 2 §6): the family tint, a large
	// glyph in the family colour at 22 %, bottom-right, a faint wave pattern, and "Photo coming soon".
	let {
		category,
		kind,
		label = true
	}: { category?: Category; kind?: Kind; label?: boolean } = $props();

	const look = $derived(
		kind
			? kinds[kind]
			: category
				? { icon: categoryIcons[category], family: categoryFamily[category] }
				: { icon: WavesIcon, family: 'coast' as const }
	);
	const tint = $derived(familyTint[look.family]);
</script>

<div class={['relative flex h-full w-full items-end p-3', tint.bg]}>
	<span class={['waves absolute inset-0', tint.fg]} aria-hidden="true"></span>
	<look.icon
		size={72}
		aria-hidden="true"
		class={['absolute right-1 bottom-1 h-auto w-[min(72px,60%)] opacity-[.22]', tint.fg]}
	/>
	{#if label}<span class="relative type-small text-text-2">{m.photo_soon()}</span>{/if}
</div>

<style>
	.waves {
		background: currentColor;
		opacity: 0.04;
		mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='14'%3E%3Cpath d='M0 7q10-6 20 0t20 0' fill='none' stroke='%23000' stroke-width='1.5'/%3E%3C/svg%3E")
			0 0 / 40px 14px repeat;
	}
</style>
