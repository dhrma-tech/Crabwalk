<script lang="ts">
	import type { Snippet } from 'svelte';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';

	// A plan workspace section (P11 §3): surface card whose heading button folds it. `id` is the outline anchor and
	// the section Crabby switches to (P12 drive).
	let {
		id,
		title,
		open = $bindable(true),
		children
	}: { id: string; title: string; open?: boolean; children: Snippet } = $props();
</script>

<section {id} aria-labelledby="{id}-title" class="scroll-mt-4 rounded-lg bg-surface shadow-e1">
	<h2 id="{id}-title" class="type-h2">
		<button
			type="button"
			class="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left print:pointer-events-none"
			aria-expanded={open}
			aria-controls="{id}-body"
			data-drive="switchTab:{id}"
			onclick={() => (open = !open)}
		>
			{title}
			<ChevronDown
				size={20}
				aria-hidden="true"
				class={[
					'shrink-0 text-text-2 transition-transform duration-(--dur-state) ease-brand print:hidden',
					!open && '-rotate-90'
				]}
			/>
		</button>
	</h2>
	<div id="{id}-body" class={['flex flex-col gap-4 px-4 pb-4', !open && 'hidden print:flex']}>
		{@render children()}
	</div>
</section>
