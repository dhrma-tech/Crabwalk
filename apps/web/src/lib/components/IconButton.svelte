<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	// Report 2 §8 icon button: 44 px round, surface + e1; `glass` over photos and the map (`'lg'`: from lg up only,
	// for a ListingCard that is a row below lg). Always labelled.
	let {
		label,
		glass = false,
		children,
		class: cls,
		type = 'button',
		...rest
	}: HTMLButtonAttributes & { label: string; glass?: boolean | 'lg'; children: Snippet } = $props();
</script>

<button
	{type}
	aria-label={label}
	class={[
		'inline-flex size-11 shrink-0 items-center justify-center rounded-full text-text shadow-e1',
		'transition-[transform,background-color] duration-(--dur-press) ease-brand active:scale-[.97]',
		'disabled:text-muted disabled:active:scale-100',
		glass === 'lg'
			? 'max-lg:bg-surface max-lg:hover:bg-surface-2 lg:glass'
			: glass
				? 'glass'
				: 'bg-surface hover:bg-surface-2',
		cls
	]}
	{...rest}
>
	{@render children()}
</button>
