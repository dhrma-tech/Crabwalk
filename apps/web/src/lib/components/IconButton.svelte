<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	// Report 2 §8 icon button: 44 px round, surface + e1; `glass` over photos and the map (`'lg'`: from lg up only,
	// for a ListingCard that is a row below lg). Always labelled. Press (brief section 4.7) scales the icon, not the
	// button, so the 44 px hit box never shrinks under the finger.
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
		'group/press inline-flex size-11 shrink-0 items-center justify-center rounded-full text-text shadow-e1',
		'transition-[background-color] duration-(--dur-press) ease-brand disabled:text-muted',
		glass === 'lg'
			? 'max-lg:bg-surface max-lg:hover:bg-surface-2 lg:glass'
			: glass
				? 'glass-lg'
				: 'bg-surface hover:bg-surface-2',
		cls
	]}
	{...rest}
>
	<span
		class="flex transition-transform duration-(--dur-press) ease-brand group-enabled/press:group-active/press:scale-[.97]"
		>{@render children()}</span
	>
</button>
