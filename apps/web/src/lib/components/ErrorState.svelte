<script lang="ts">
	import type { Snippet } from 'svelte';

	// FRONTEND §6.12: what happened + what to do. Never a raw error. Suna 6a: tint block (sakura = error,
	// fuji = 404), serif title.
	let {
		title,
		body,
		tone = 'sakura',
		action
	}: { title: string; body: string; tone?: 'sakura' | 'fuji'; action?: Snippet } = $props();
</script>

<div class="flex max-w-[680px] flex-col gap-3 py-6" role="alert" data-clip-check>
	<div class="h-24 w-full" style:background="var(--{tone})" aria-hidden="true"></div>
	<h2 class="type-h1">{title}</h2>
	<p class="type-small text-text-2">{body}</p>
	{#if action}<div class="pt-1">{@render action()}</div>{/if}
</div>
