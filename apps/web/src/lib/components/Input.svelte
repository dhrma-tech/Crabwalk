<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	// FRONTEND §6.11: 48 px, 12 px radius, sand-50 fill, sea 2 px focus ring.
	let {
		label,
		id,
		error,
		value = $bindable(),
		...rest
	}: HTMLInputAttributes & { label: string; id: string; error?: string | null } = $props();
</script>

<div class="flex flex-col gap-1.5" data-clip-check>
	<label for={id} class="type-small text-text-2">{label}</label>
	<input
		{id}
		bind:value
		aria-invalid={error ? true : undefined}
		aria-describedby={error ? `${id}-error` : undefined}
		class="h-12 w-full rounded-input border border-border bg-surface px-4 type-body text-text focus:outline-2 focus:outline-offset-0 focus:outline-sea-500 dark:focus:outline-link"
		{...rest}
	/>
	{#if error}<p id={`${id}-error`} class="type-small text-text">{error}</p>{/if}
</div>
