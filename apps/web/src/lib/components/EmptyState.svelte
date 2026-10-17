<script lang="ts">
	import type { Snippet } from 'svelte';
	import Crabby from './Crabby.svelte';

	// FRONTEND §6.12: Crabby illustration + invitation + at most one CTA.
	let { title, body, action }: { title: string; body: string; action?: Snippet } = $props();
</script>

<div
	class="mx-auto flex max-w-[680px] flex-col items-center gap-3 py-12 text-center"
	data-clip-check
>
	<Crabby size={96} />
	<h2 class="type-h1">{title}</h2>
	<p class="type-body text-text-2">{body}</p>
	{#if action}<div class="pt-2">{@render action()}</div>{/if}
</div>
