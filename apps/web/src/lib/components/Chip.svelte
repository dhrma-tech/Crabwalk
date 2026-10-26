<script lang="ts">
	import type { Snippet } from 'svelte';
	import Check from '@lucide/svelte/icons/check';

	// Filter chip (Report 2 §8): 36 px sunken pill in a 44 px target; selected = ink fill + check. `glass`: over a
	// map or photo (Report 2 §9.3).
	let {
		selected = $bindable(false),
		glass = false,
		onchange,
		children
	}: {
		selected?: boolean;
		glass?: boolean;
		onchange?: (selected: boolean) => void;
		children: Snippet;
	} = $props();
</script>

<button
	type="button"
	aria-pressed={selected}
	class="group inline-flex min-h-11 shrink-0 items-center text-left"
	onclick={() => {
		selected = !selected;
		onchange?.(selected);
	}}
>
	<span
		class={[
			'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 py-1 type-label',
			'transition-[background-color,color,transform] duration-(--dur-state) ease-brand group-active:scale-[.97]',
			selected
				? 'bg-text text-bg'
				: glass
					? 'glass text-text shadow-e1'
					: 'bg-surface-2 text-text group-hover:bg-surface-3'
		]}
	>
		{#if selected}<Check size={16} aria-hidden="true" />{/if}
		{@render children()}
	</span>
</button>
