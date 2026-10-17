<script lang="ts">
	import type { Snippet } from 'svelte';
	import Check from '@lucide/svelte/icons/check';

	// Filter chip (FRONTEND §6.2): toggle; selected = sea fill + white + check.
	let {
		selected = $bindable(false),
		onchange,
		children
	}: { selected?: boolean; onchange?: (selected: boolean) => void; children: Snippet } = $props();
</script>

<button
	type="button"
	aria-pressed={selected}
	class={[
		'inline-flex min-h-11 items-center gap-1.5 rounded-chip border px-4 py-1.5 text-left type-small',
		'transition-colors duration-200 ease-brand',
		selected ? 'border-sea-500 bg-sea-500 text-white' : 'border-border bg-surface text-text'
	]}
	onclick={() => {
		selected = !selected;
		onchange?.(selected);
	}}
>
	{#if selected}<Check size={16} aria-hidden="true" />{/if}
	{@render children()}
</button>
