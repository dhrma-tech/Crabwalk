<script lang="ts">
	import type { Snippet } from 'svelte';

	// Phone: a scroll-snap row that bleeds to the screen edge so the next card peeks. Laptop: 4-up grid.
	// Pass `<li>`s; each holds one HeroCard (280 px wide on phones).
	let { label, children }: { label: string; children: Snippet } = $props();
</script>

<ul
	aria-label={label}
	class="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-2 *:w-70 *:shrink-0 *:snap-start lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:px-0 lg:*:w-auto"
>
	{@render children()}
</ul>
