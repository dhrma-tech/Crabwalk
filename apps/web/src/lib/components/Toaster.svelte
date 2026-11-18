<script lang="ts">
	import { fly } from 'svelte/transition';
	import { cubicIn, cubicOut } from 'svelte/easing';
	import { toasts } from '#lib/toast.svelte.ts';
	import { dur } from '#lib/motion.ts';
</script>

<!-- Report 2 §8: ink toast above the phone nav, slides up, 4 s (toast.svelte.ts). -->
<div
	class="pointer-events-none fixed inset-x-4 bottom-[calc(var(--nav-h)+16px)] z-overlay flex flex-col items-center gap-2"
	role="status"
	aria-live="polite"
>
	{#each toasts as t (t.id)}
		<p
			class="max-w-170 rounded-md bg-text px-4 py-3 type-small text-bg shadow-e3"
			in:fly={{ y: 16, duration: dur(260), easing: cubicOut }}
			out:fly={{ y: 16, duration: dur(180), easing: cubicIn }}
		>
			{t.text}
		</p>
	{/each}
</div>
