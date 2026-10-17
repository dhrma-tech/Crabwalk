<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';

	// Vibe tags (FRONTEND §6.2): max 3 shown, then "+N".
	let { tags, max = 3 }: { tags: string[]; max?: number } = $props();
	const shown = $derived(tags.slice(0, max));
	const rest = $derived(tags.length - shown.length);
</script>

<ul class="flex flex-wrap gap-1.5">
	{#each shown as tag (tag)}
		<li class="rounded-chip bg-bg px-2.5 py-0.5 type-tiny text-text-2">{tag}</li>
	{/each}
	{#if rest > 0}
		<li class="rounded-chip bg-bg px-2.5 py-0.5 type-tiny text-text-2">
			{m.more_count({ count: rest })}
		</li>
	{/if}
</ul>
