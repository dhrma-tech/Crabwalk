<script lang="ts">
	// Brand mark (user choice, 2026-11-03): the Crabby crab silhouette and `crabwalk` in lowercase Figtree 700, kokum.
	// Decorative: the link around it carries the name.
	import Crabby from './Crabby.svelte';

	let { size = 32, wordmark = false }: { size?: number; wordmark?: boolean } = $props();
</script>

<span class="flex shrink-0 items-center gap-1 text-kokum" aria-hidden="true">
	<Crabby {size} />
	{#if wordmark}<span class="wordmark leading-none" lang="en">crabwalk</span>{/if}
</span>

<style>
	.wordmark {
		font: 700 24px/30px var(--font-body);
		letter-spacing: -0.02em;
	}
</style>
