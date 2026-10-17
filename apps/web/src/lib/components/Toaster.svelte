<script lang="ts">
	import { fly } from 'svelte/transition';
	import { toasts } from '#lib/toast.svelte.ts';
</script>

<div
	class="pointer-events-none fixed inset-x-4 bottom-[calc(80px+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 lg:bottom-6"
	role="status"
	aria-live="polite"
>
	{#each toasts as t (t.id)}
		<p
			class="max-w-[680px] rounded-card border border-sand-700 bg-sand-900 px-4 py-3 type-small text-sand-100 shadow-float"
			transition:fly={{ y: 16, duration: 200 }}
		>
			{t.text}
		</p>
	{/each}
</div>
