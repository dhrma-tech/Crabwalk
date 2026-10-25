<script lang="ts" module>
	import TreePalm from '@lucide/svelte/icons/tree-palm';
	import Castle from '@lucide/svelte/icons/castle';
	import Flame from '@lucide/svelte/icons/flame';
	import Droplets from '@lucide/svelte/icons/droplets';
	import Binoculars from '@lucide/svelte/icons/binoculars';
	import Waves from '@lucide/svelte/icons/waves';
	import Mountain from '@lucide/svelte/icons/mountain';
	import Landmark from '@lucide/svelte/icons/landmark';
	import House from '@lucide/svelte/icons/house';
	import Store from '@lucide/svelte/icons/store';
	import Trees from '@lucide/svelte/icons/trees';
	import type { Database } from '#lib/db.types.ts';

	export type Category = Database['public']['Enums']['place_category'];
	export type Family = 'coast' | 'heritage' | 'land';

	// Lucide placeholders (FRONTEND §3, custom set [OPEN]). Same glyphs as map pins; swap here only.
	export const categoryIcons = {
		beach: TreePalm,
		fort: Castle,
		temple: Flame,
		waterfall: Droplets,
		viewpoint: Binoculars,
		backwater: Waves,
		cave: Mountain,
		museum: Landmark,
		village: House,
		market: Store,
		orchard: Trees
	} satisfies Record<Category, unknown>;

	// Category families (Report 2 §3.3): tiles, no-photo cards and the map legend share these tints.
	export const categoryFamily = {
		beach: 'coast',
		backwater: 'coast',
		waterfall: 'coast',
		fort: 'heritage',
		temple: 'heritage',
		museum: 'heritage',
		cave: 'heritage',
		viewpoint: 'land',
		village: 'land',
		market: 'land',
		orchard: 'land'
	} as const satisfies Record<Category, Family>;

	// Land icons use alphonso-ink: alphonso itself is never text or a glyph on its own tint (T-19).
	export const familyTint: Record<Family, { bg: string; fg: string }> = {
		coast: { bg: 'bg-lagoon-50', fg: 'text-lagoon' },
		heritage: { bg: 'bg-laterite-50', fg: 'text-laterite' },
		land: { bg: 'bg-alphonso-50', fg: 'text-alphonso-ink' }
	};
</script>

<script lang="ts">
	// `tile` = the 40 px rounded tile in the family tint (Report 2 §6).
	let {
		category,
		size = 20,
		label,
		tile = false
	}: { category: Category; size?: number; label?: string; tile?: boolean } = $props();
	const Icon = $derived(categoryIcons[category]);
	const tint = $derived(familyTint[categoryFamily[category]]);
</script>

{#snippet glyph()}
	<Icon
		{size}
		aria-label={label}
		aria-hidden={label ? undefined : 'true'}
		role={label ? 'img' : undefined}
	/>
{/snippet}

{#if tile}
	<span class={['flex size-10 shrink-0 items-center justify-center rounded-md', tint.bg, tint.fg]}
		>{@render glyph()}</span
	>
{:else}
	{@render glyph()}
{/if}
