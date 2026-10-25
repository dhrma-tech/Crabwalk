<script lang="ts">
	import type { LucideIcon } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';

	// Quick facts (Report 2 §8): sunken tiles, 2 across (3 when wide), lagoon icon + label + value. Unknown facts
	// say so instead of being hidden (FRONTEND §13).
	let { rows }: { rows: { label: string; value: string | null | undefined; icon?: LucideIcon }[] } =
		$props();
</script>

<div class="@container">
	<dl class="grid grid-cols-2 gap-2 @3xl:grid-cols-3" data-clip-check>
		{#each rows as r (r.label)}
			<div class="flex flex-col gap-1 rounded-md bg-surface-2 p-3">
				<dt class="flex items-center gap-1.5 type-small text-text-2">
					{#if r.icon}<r.icon size={20} aria-hidden="true" class="text-lagoon" />{/if}{r.label}
				</dt>
				<dd class={[r.value ? 'type-body-strong' : 'type-body text-text-2']}>
					{r.value || m.not_known()}
				</dd>
			</div>
		{/each}
	</dl>
</div>
