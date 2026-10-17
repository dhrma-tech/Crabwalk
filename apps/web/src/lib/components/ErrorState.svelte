<script lang="ts">
	import type { Snippet } from 'svelte';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';

	// FRONTEND §6.12: what happened + what to do. Never a raw error.
	let { title, body, action }: { title: string; body: string; action?: Snippet } = $props();
</script>

<div
	class="mx-auto flex max-w-[680px] flex-col items-center gap-3 py-12 text-center"
	role="alert"
	data-clip-check
>
	<CircleAlert size={48} class="text-laterite-500 dark:text-cta" aria-hidden="true" />
	<h2 class="type-h1">{title}</h2>
	<p class="type-body text-text-2">{body}</p>
	{#if action}<div class="pt-2">{@render action()}</div>{/if}
</div>
