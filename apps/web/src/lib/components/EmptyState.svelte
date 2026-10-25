<script lang="ts">
	import type { Snippet } from 'svelte';
	import Illustration from './Illustration.svelte';

	// Report 2 §8: illustration + heading + one sentence + at most one CTA.
	let {
		title,
		body,
		art = 'crab',
		action
	}: { title: string; body: string; art?: 'crab' | 'boat' | 'fort'; action?: Snippet } = $props();
</script>

<div class="mx-auto flex max-w-170 flex-col items-center gap-2 py-8 text-center" data-clip-check>
	<Illustration name={art} />
	<h2 class="mt-2 type-h2">{title}</h2>
	<p class="type-body text-text-2">{body}</p>
	{#if action}<div class="pt-2">{@render action()}</div>{/if}
</div>
