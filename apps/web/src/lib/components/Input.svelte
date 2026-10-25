<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import SearchIcon from '@lucide/svelte/icons/search';

	// Report 2 §8 field: 52 px sunken, no border at rest; focus = ink border + surface fill (`field`); error =
	// danger border + message with an icon. `search` = leading icon on a pill.
	let {
		label,
		id,
		error,
		search = false,
		value = $bindable(),
		...rest
	}: HTMLInputAttributes & {
		label: string;
		id: string;
		error?: string | null;
		search?: boolean;
	} = $props();
</script>

<div class="flex flex-col gap-1.5" data-clip-check>
	<label for={id} class="type-small text-text-2">{label}</label>
	<div class={['field flex min-h-13 items-center gap-2 px-4', search && 'rounded-full']}>
		{#if search}<SearchIcon size={20} aria-hidden="true" class="text-text-2" />{/if}
		<input
			{id}
			bind:value
			aria-invalid={error ? true : undefined}
			aria-describedby={error ? `${id}-error` : undefined}
			class="h-12 min-w-0 flex-1 bg-transparent type-body text-text placeholder:text-muted"
			{...rest}
		/>
	</div>
	{#if error}
		<p id={`${id}-error`} class="flex items-start gap-1.5 type-small text-danger">
			<CircleAlert size={16} aria-hidden="true" class="mt-0.5" />{error}
		</p>
	{/if}
</div>
