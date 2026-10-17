<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';

	// Quick facts grid. Unknown facts say so instead of being hidden (FRONTEND §13).
	let { rows }: { rows: { label: string; value: string | null | undefined }[] } = $props();
</script>

<dl class="grid gap-3 sm:grid-cols-2" data-clip-check>
	{#each rows as r (r.label)}
		<div class="rounded-card border border-border bg-surface p-3">
			<dt class="type-small text-text-2">{r.label}</dt>
			<dd class={['type-body', !r.value && 'text-text-2']}>{r.value || m.not_known()}</dd>
		</div>
	{/each}
</dl>
