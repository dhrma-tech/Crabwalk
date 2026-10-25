<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';

	// Vibe tags (Report 2 §8): 28 px sunken pills, max 3 shown, then "+N".
	let { tags, max = 3 }: { tags: string[]; max?: number } = $props();
	const shown = $derived(tags.slice(0, max));
	const rest = $derived(tags.length - shown.length);
</script>

<ul class="flex flex-wrap gap-1.5">
	{#each shown as tag (tag)}
		<li class="flex min-h-7 items-center rounded-full bg-surface-2 px-2.5 type-small text-text-2">
			{tag}
		</li>
	{/each}
	{#if rest > 0}
		<li class="flex min-h-7 items-center px-1 type-small text-text-2">
			{m.more_count({ count: rest })}
		</li>
	{/if}
</ul>
