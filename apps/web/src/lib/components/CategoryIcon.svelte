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

	// Lucide placeholders (FRONTEND §3, custom set [OPEN]). Same glyphs as map pins; swap here only.
	const icons = {
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
</script>

<script lang="ts">
	let {
		category,
		size = 20,
		label
	}: { category: Category; size?: number; label?: string } = $props();
	const Icon = $derived(icons[category]);
</script>

<Icon
	{size}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
	role={label ? 'img' : undefined}
/>
