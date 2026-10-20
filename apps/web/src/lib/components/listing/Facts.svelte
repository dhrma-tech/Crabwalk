<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';

	// Quick facts grid. Unknown facts say so instead of being hidden (FRONTEND §13).
	let { rows }: { rows: { label: string; value: string | null | undefined }[] } = $props();
</script>

<div class="@container">
	<dl class="grid border-t border-text @md:grid-cols-2 @md:gap-x-8" data-clip-check>
		{#each rows as r (r.label)}
			<div class="flex justify-between gap-4 border-b border-border py-2">
				<dt class="text-[13px] text-text-2">{r.label}</dt>
				<dd class={['text-right type-body', !r.value && 'text-text-2']}>
					{r.value || m.not_known()}
				</dd>
			</div>
		{/each}
	</dl>
</div>
