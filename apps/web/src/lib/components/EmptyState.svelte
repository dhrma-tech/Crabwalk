<script lang="ts">
	import type { Snippet } from 'svelte';

	// FRONTEND §6.12 in Suna (6a): a quiet tint block + one-line invitation + at most one CTA.
	type Tone = 'fuji' | 'sakura' | 'asagi' | 'wakaba' | 'yama';
	let {
		title,
		body,
		tone = 'fuji',
		action
	}: { title: string; body: string; tone?: Tone; action?: Snippet } = $props();
</script>

<div class="flex max-w-[680px] flex-col gap-3 py-6" data-clip-check>
	<div class="h-24 w-full" style:background="var(--{tone})" aria-hidden="true"></div>
	<h2 class="type-h1">{title}</h2>
	<p class="type-small text-text-2">{body}</p>
	{#if action}<div class="pt-1">{@render action()}</div>{/if}
</div>
