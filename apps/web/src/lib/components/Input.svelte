<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	// Suna field (6a): small grey label, value on an ink underline; 44 px target, ink focus ring.
	let {
		label,
		id,
		error,
		value = $bindable(),
		...rest
	}: HTMLInputAttributes & { label: string; id: string; error?: string | null } = $props();
</script>

<div class="flex flex-col gap-0.5" data-clip-check>
	<label for={id} class="text-[12px] text-text-2">{label}</label>
	<input
		{id}
		bind:value
		aria-invalid={error ? true : undefined}
		aria-describedby={error ? `${id}-error` : undefined}
		class="h-11 w-full border-b border-text bg-transparent type-body text-text placeholder:text-text-2"
		{...rest}
	/>
	{#if error}<p id={`${id}-error`} class="type-small text-caution">{error}</p>{/if}
</div>
