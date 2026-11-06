<script lang="ts">
	import Lock from '@lucide/svelte/icons/lock';
	import { MONTHS, type Field } from '#lib/admin/fields.ts';
	import GpsInput from './GpsInput.svelte';

	// One editor field, by kind (lib/admin/fields.ts). Unknown is an explicit choice and is stored as null.
	let {
		field,
		value = $bindable(),
		error = null,
		missing = false,
		changed = false,
		talukas = [],
		tides = []
	}: {
		field: Field;
		value: unknown;
		error?: string | null;
		missing?: boolean;
		changed?: boolean;
		talukas?: { id: string; name: string }[];
		tides?: { id: string; name: string }[];
	} = $props();

	const id = $derived(`f-${field.key.replace(/[^\w]/g, '-')}`);
	const human = (s: string) => s.replace(/_/g, ' ');
	const input =
		'min-h-12 w-full rounded-md border bg-surface px-3 type-body text-text disabled:opacity-60';
	const border = $derived(
		error ? 'border-danger' : missing ? 'border-alphonso border-2' : 'border-border-strong'
	);
	const list = $derived(Array.isArray(value) ? (value as string[]) : []);
	const choices: readonly string[] = $derived(
		field.kind === 'months' ? MONTHS : (field.options ?? [])
	);
	const answers: readonly (boolean | null)[] = $derived(
		field.kind === 'tri' ? [true, false, null] : [true, false]
	);
	const num = (s: string) => (s.trim() === '' ? null : Number(s));
	const pill = (on: boolean) => [
		'min-h-11 rounded-full border px-3 type-label transition-colors duration-(--dur-state)',
		on ? 'border-kokum bg-kokum text-on-kokum' : 'border-border-strong bg-surface text-text-2'
	];
	function toggle(opt: string) {
		const has = list.includes(opt);
		if (!has && field.max && list.length >= field.max) return;
		value = has ? list.filter((x) => x !== opt) : [...list, opt];
	}
</script>

<div class="flex flex-col gap-1.5" data-field={field.key}>
	<label for={id} id="{id}-l" class="flex flex-wrap items-center gap-2 type-label text-text">
		<span
			>{field.label}{#if field.required}<span class="text-danger" aria-hidden="true">
					*</span
				>{/if}</span
		>
		{#if field.required}<span class="sr-only">(required)</span>{/if}
		{#if field.private}<span
				class="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 type-small text-text-2"
				><Lock size={12} aria-hidden="true" />Private</span
			>{/if}
		{#if changed}<span class="rounded-full bg-lagoon-50 px-2 py-0.5 type-small text-lagoon-ink"
				>edited</span
			>{/if}
	</label>

	{#if field.kind === 'long' || field.kind === 'lines' || field.kind === 'urls'}
		<textarea
			{id}
			class={[input, border, 'min-h-24 py-2']}
			lang={field.lang}
			rows={field.kind === 'long' ? 3 : 4}
			maxlength={field.kind === 'long' ? field.max : undefined}
			aria-invalid={!!error}
			aria-describedby="{id}-help"
			value={field.kind === 'long' ? ((value as string) ?? '') : list.join('\n')}
			oninput={(e) => {
				const t = e.currentTarget.value;
				value = field.kind === 'long' ? t : t.split('\n').map((x) => x.trimStart());
			}}
			onchange={(e) => {
				if (field.kind !== 'long')
					value = e.currentTarget.value
						.split('\n')
						.map((x) => x.trim())
						.filter(Boolean);
			}}></textarea>
	{:else if field.kind === 'enum' || field.kind === 'taluka' || field.kind === 'tide'}
		<select
			{id}
			class={[input, border]}
			aria-invalid={!!error}
			aria-describedby="{id}-help"
			value={(value as string) ?? ''}
			onchange={(e) => (value = e.currentTarget.value || null)}
		>
			<option value="">Unknown</option>
			{#if field.kind === 'enum'}
				{#each field.options ?? [] as o (o)}<option value={o}>{human(o)}</option>{/each}
			{:else}
				{#each field.kind === 'taluka' ? talukas : tides as o (o.id)}<option value={o.id}
						>{o.name}</option
					>{/each}
			{/if}
		</select>
	{:else if field.kind === 'multi' || field.kind === 'months'}
		<div class="flex flex-wrap gap-2" role="group" aria-labelledby="{id}-l" {id}>
			{#each choices as o (o)}
				{@const on = list.includes(o)}
				<button
					type="button"
					class={pill(on)}
					aria-pressed={on}
					disabled={!on && !!field.max && list.length >= field.max}
					onclick={() => toggle(o)}>{human(o)}</button
				>
			{/each}
		</div>
		{#if field.max}<p class="type-small text-text-2">{list.length} of max {field.max}</p>{/if}
	{:else if field.kind === 'tri' || field.kind === 'bool'}
		<div
			class="flex flex-wrap gap-2"
			role="radiogroup"
			{id}
			aria-labelledby="{id}-l"
			aria-describedby="{id}-help"
		>
			{#each answers as o (String(o))}
				<button
					type="button"
					role="radio"
					aria-checked={value === o || (o === null && value == null)}
					class={pill(value === o || (o === null && value == null))}
					onclick={() => (value = o)}>{o === true ? 'Yes' : o === false ? 'No' : 'Unknown'}</button
				>
			{/each}
		</div>
	{:else if field.kind === 'int' || field.kind === 'money' || field.kind === 'km'}
		<input
			{id}
			type="number"
			class={[input, border]}
			inputmode={field.kind === 'km' ? 'decimal' : 'numeric'}
			step={field.kind === 'km' ? '0.1' : '1'}
			min={field.min ?? 0}
			max={field.max}
			aria-invalid={!!error}
			aria-describedby="{id}-help"
			value={(value as number | null) ?? ''}
			onchange={(e) => (value = num(e.currentTarget.value))}
		/>
	{:else if field.kind === 'time' || field.kind === 'date'}
		<input
			{id}
			type={field.kind}
			class={[input, border]}
			aria-invalid={!!error}
			aria-describedby="{id}-help"
			value={(value as string) ?? ''}
			onchange={(e) => (value = e.currentTarget.value || null)}
		/>
	{:else if field.kind === 'gps'}
		<GpsInput bind:value {error} {missing} />
	{:else}
		<input
			{id}
			type={field.kind === 'email'
				? 'email'
				: field.kind === 'url'
					? 'url'
					: field.kind === 'phone'
						? 'tel'
						: 'text'}
			inputmode={field.kind === 'phone' ? 'tel' : undefined}
			class={[input, border, field.kind === 'code' && 'uppercase']}
			lang={field.lang}
			maxlength={field.max}
			aria-invalid={!!error}
			aria-describedby="{id}-help"
			value={(value as string) ?? ''}
			oninput={(e) => {
				const t = e.currentTarget.value;
				value = field.kind === 'code' ? t.toUpperCase() : t;
			}}
		/>
	{/if}

	<div id="{id}-help" class="flex flex-col gap-0.5">
		{#if error}<p class="type-small text-danger" role="alert">{error}</p>{/if}
		{#if missing && !error}<p class="type-small text-caution">Required — still empty</p>{/if}
		{#if field.help}<p class="type-small text-text-2">{field.help}</p>{/if}
		{#if field.kind === 'long' && field.max}<p class="type-small text-text-2">
				{((value as string) ?? '').length} / {field.max}
			</p>{/if}
	</div>
</div>
