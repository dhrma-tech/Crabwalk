<script lang="ts">
	import type { Snippet } from 'svelte';
	import Illustration from './Illustration.svelte';

	// FRONTEND §6.12: what happened + what to do. Never a raw error. Report 2 §8: illustration (fort = 404,
	// boat = offline) + heading + one sentence + one CTA.
	let {
		title,
		body,
		art,
		action
	}: { title: string; body: string; art?: 'fort' | 'boat'; action?: Snippet } = $props();
</script>

<div
	class="mx-auto flex max-w-170 flex-col items-center gap-2 py-8 text-center"
	role="alert"
	data-clip-check
>
	{#if art}<Illustration name={art} />{/if}
	<h2 class="mt-2 type-h2">{title}</h2>
	<p class="type-body text-text-2">{body}</p>
	{#if action}<div class="pt-2">{@render action()}</div>{/if}
</div>
