<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import Button from '../Button.svelte';

	// GET form so filters live in the URL (shareable, work without JS).
	let {
		fields
	}: {
		fields: {
			name: string;
			label: string;
			value: string | number | undefined;
			options?: { value: string; label: string }[];
			type?: 'number';
		}[];
	} = $props();
</script>

<form method="GET" class="flex flex-wrap items-end gap-x-6 gap-y-3" data-clip-check>
	{#each fields as f (f.name)}
		<label class="flex min-w-36 flex-1 flex-col text-[12px] text-text-2">
			{f.label}
			{#if f.options}
				<select
					name={f.name}
					value={f.value ?? ''}
					class="h-11 border-b border-text bg-bg type-body text-text"
				>
					<option value="">{m.filter_any()}</option>
					{#each f.options as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
				</select>
			{:else}
				<input
					name={f.name}
					type="number"
					min="0"
					step="100"
					inputmode="numeric"
					value={f.value ?? ''}
					class="h-11 border-b border-text bg-bg type-body text-text"
				/>
			{/if}
		</label>
	{/each}
	<Button type="submit" variant="secondary">{m.apply_filters()}</Button>
</form>
