<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	// Report 2 §8 icon button: 44 px round, surface + e1; `glass` over photos and the map. Always labelled.
	let {
		label,
		glass = false,
		children,
		class: cls,
		type = 'button',
		...rest
	}: HTMLButtonAttributes & { label: string; glass?: boolean; children: Snippet } = $props();
</script>

<button
	{type}
	aria-label={label}
	class={[
		'inline-flex size-11 shrink-0 items-center justify-center rounded-full text-text shadow-e1',
		'transition-[transform,background-color] duration-(--dur-press) ease-brand active:scale-[.97]',
		'disabled:text-muted disabled:active:scale-100',
		glass ? 'glass' : 'bg-surface hover:bg-surface-2',
		cls
	]}
	{...rest}
>
	{@render children()}
</button>
