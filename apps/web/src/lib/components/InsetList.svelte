<script lang="ts">
	import type { Snippet } from 'svelte';

	// Inset list (Report 2 §8): rows on one surface card, separated by hairlines. Rows use `row-link`.
	// `gridLg`: a three-column card grid from lg up (with ListingCard row="below-lg").
	let { gridLg = false, children }: { gridLg?: boolean; children: Snippet } = $props();
</script>

<div
	class={gridLg
		? 'max-lg:divide-y max-lg:divide-border max-lg:overflow-hidden max-lg:rounded-lg max-lg:bg-surface max-lg:shadow-e1 lg:grid lg:grid-cols-3 lg:gap-5'
		: 'divide-y divide-border overflow-hidden rounded-lg bg-surface shadow-e1'}
>
	{@render children()}
</div>
