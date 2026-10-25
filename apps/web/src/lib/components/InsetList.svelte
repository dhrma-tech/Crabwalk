<script lang="ts">
	import type { Snippet } from 'svelte';

	// Inset list (Report 2 §8): rows on one surface card, separated by hairlines. Rows use `row-link`.
	let { children }: { children: Snippet } = $props();
</script>

<div class="divide-y divide-border overflow-hidden rounded-lg bg-surface shadow-e1">
	{@render children()}
</div>
