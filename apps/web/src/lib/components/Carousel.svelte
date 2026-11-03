<script lang="ts">
	import type { Snippet } from 'svelte';
	import ScrollProgress from './ScrollProgress.svelte';

	// A scroll-snap row on every screen (user, 2026-11-03); on phones it bleeds to the screen edge so the next
	// card peeks. Pass `<li>`s; each holds one card (280 px wide, 300 px on laptops).
	let { label, children }: { label: string; children: Snippet } = $props();
</script>

<div class="scroll-scope">
	<ul
		aria-label={label}
		class="scroll-row -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-2 *:w-70 *:shrink-0 *:snap-start lg:mx-0 lg:scroll-px-0 lg:gap-5 lg:px-0 lg:*:w-75"
	>
		{@render children()}
	</ul>
	<ScrollProgress />
</div>
