<script lang="ts">
	import type { Snippet } from 'svelte';
	import Check from '@lucide/svelte/icons/check';

	// Filter chip (FRONTEND §6.2): toggle; selected = ink fill + check (Suna map chips).
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
		'inline-flex min-h-11 shrink-0 items-center gap-1.5 border border-text px-3 py-1 text-left type-small',
		'transition-colors duration-200 ease-brand',
		selected ? 'bg-text text-bg' : 'bg-bg text-text hover:bg-text/5'
	]}
	onclick={() => {
		selected = !selected;
		onchange?.(selected);
	}}
>
	{#if selected}<Check size={16} aria-hidden="true" />{/if}
	{@render children()}
</button>
