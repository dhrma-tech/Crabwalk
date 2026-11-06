<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import Trash from '@lucide/svelte/icons/trash-2';
	import { WEEKDAYS, type Repeat } from '#lib/admin/fields.ts';
	import Button from '../Button.svelte';
	import Picker from './Picker.svelte';

	// Repeating rows (room types, menu items, utilities, timing slots, seasons, links …): add / remove rows.
	let {
		repeat,
		rows = $bindable(),
		errors = {},
		labels = {},
		broken = {}
	}: {
		repeat: Repeat;
		rows: Record<string, unknown>[];
		errors?: Record<string, string>;
		labels?: Record<string, string>;
		broken?: Record<string, 'missing' | 'archived'>;
	} = $props();

	const human = (s: string) => s.replace(/_/g, ' ');
	const field =
		'min-h-11 w-full rounded-md border border-border-strong bg-surface px-2 type-body text-text';
	const num = (s: string) => (s.trim() === '' ? null : Number(s));
	function set(i: number, key: string, v: unknown) {
		rows = rows.map((r, j) => (j === i ? { ...r, [key]: v } : r));
	}
	const blank = () =>
		Object.fromEntries(repeat.cols.map((c) => [c.key, c.kind === 'bool' ? false : null]));
</script>

<fieldset class="flex flex-col gap-3" data-repeat={repeat.key}>
	<legend class="type-h3">{repeat.title}</legend>
	{#if errors[repeat.key]}<p class="type-small text-danger" role="alert">
			{errors[repeat.key]}
		</p>{/if}
	{#each rows as row, i (i)}
		<div
			class="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:flex-wrap sm:items-end"
		>
			{#each repeat.cols as c (c.key)}
				{@const err = errors[`${repeat.key}.${i}.${c.key}`]}
				<label class="flex min-w-32 flex-1 flex-col gap-1 type-small text-text-2"
					>{c.label}
					{#if c.kind === 'dish' || c.kind === 'eatery'}
						<Picker
							kind={c.kind}
							bind:value={() => row[c.key], (v) => set(i, c.key, v)}
							{labels}
							broken={typeof row[c.key] === 'string'
								? (broken[row[c.key] as string] ?? null)
								: null}
						/>
					{:else if c.kind === 'weekday'}
						<select
							class={field}
							value={row[c.key] ?? ''}
							onchange={(e) => set(i, c.key, num(e.currentTarget.value))}
							><option value="">Unknown</option>{#each WEEKDAYS as d, n (d)}<option value={n}
									>{d}</option
								>{/each}</select
						>
					{:else if c.kind === 'enum'}
						<select
							class={field}
							value={row[c.key] ?? ''}
							onchange={(e) => set(i, c.key, e.currentTarget.value || null)}
							><option value="">Unknown</option>{#each c.options ?? [] as o (o)}<option value={o}
									>{human(o)}</option
								>{/each}</select
						>
					{:else if c.kind === 'bool'}
						<input
							type="checkbox"
							class="size-6 accent-(--kokum)"
							checked={row[c.key] === true}
							onchange={(e) => set(i, c.key, e.currentTarget.checked)}
						/>
					{:else if c.kind === 'tri'}
						<select
							class={field}
							value={row[c.key] === true ? 'yes' : row[c.key] === false ? 'no' : ''}
							onchange={(e) =>
								set(
									i,
									c.key,
									e.currentTarget.value === 'yes'
										? true
										: e.currentTarget.value === 'no'
											? false
											: null
								)}
							><option value="">Unknown</option><option value="yes">Yes</option><option value="no"
								>No</option
							></select
						>
					{:else if c.kind === 'int' || c.kind === 'money' || c.kind === 'km'}
						<input
							type="number"
							class={field}
							min="0"
							step={c.kind === 'km' ? '0.1' : '1'}
							inputmode={c.kind === 'km' ? 'decimal' : 'numeric'}
							value={row[c.key] ?? ''}
							onchange={(e) => set(i, c.key, num(e.currentTarget.value))}
						/>
					{:else if c.kind === 'time'}
						<input
							type="time"
							class={field}
							value={row[c.key] ?? ''}
							onchange={(e) => set(i, c.key, e.currentTarget.value || null)}
						/>
					{:else if c.kind === 'gps'}
						{@const g = row[c.key] as { lat: number; lng: number } | null}
						<span class="grid grid-cols-2 gap-1">
							<input
								type="number"
								step="0.000001"
								class={field}
								aria-label="Latitude"
								placeholder="lat"
								value={g?.lat ?? ''}
								onchange={(e) => {
									const lat = num(e.currentTarget.value);
									set(
										i,
										c.key,
										lat == null && g?.lng == null ? null : { lat, lng: g?.lng ?? null }
									);
								}}
							/><input
								type="number"
								step="0.000001"
								class={field}
								aria-label="Longitude"
								placeholder="lng"
								value={g?.lng ?? ''}
								onchange={(e) => {
									const lng = num(e.currentTarget.value);
									set(
										i,
										c.key,
										lng == null && g?.lat == null ? null : { lat: g?.lat ?? null, lng }
									);
								}}
							/></span
						>
					{:else}
						<input
							type={c.kind === 'url' ? 'url' : 'text'}
							class={field}
							value={(row[c.key] as string) ?? ''}
							oninput={(e) => set(i, c.key, e.currentTarget.value)}
						/>
					{/if}
					{#if err}<span class="text-danger" role="alert">{err}</span>{/if}
				</label>
			{/each}
			<button
				type="button"
				class="flex min-h-11 min-w-11 items-center justify-center gap-1 self-end rounded-md text-danger hover:bg-surface-2"
				aria-label={`Remove row ${i + 1}`}
				onclick={() => (rows = rows.filter((_, j) => j !== i))}
				><Trash size={18} aria-hidden="true" /></button
			>
		</div>
	{/each}
	{#if !repeat.max || rows.length < repeat.max}
		<div>
			<Button variant="outline" onclick={() => (rows = [...rows, blank()])}
				>{#snippet icon()}<Plus size={18} aria-hidden="true" />{/snippet}Add row</Button
			>
		</div>
	{/if}
</fieldset>
