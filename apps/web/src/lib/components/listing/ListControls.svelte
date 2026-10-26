<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import X from '@lucide/svelte/icons/x';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { formatINR } from '#lib/format.ts';
	import { SORTS, type Sort } from '#lib/sort.ts';
	import Button from '../Button.svelte';
	import IconButton from '../IconButton.svelte';

	// Stays/Food list controls (Report 2 §9.4, DECISIONS T-27): a sticky chip row with one chip per filter (tap →
	// a sheet with its choices; a set filter is an ink chip that clears it), then the result count and sort.
	// Filters and sort live in the URL (GET forms), so lists stay shareable.
	type Field = {
		name: string;
		label: string;
		value: string | number | undefined;
		options?: { value: string; label: string }[];
		type?: 'number';
	};
	let { fields, count, sort }: { fields: Field[]; count: number; sort: Sort } = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	let current = $state<Field | null>(null);
	const set = (f: Field) => f.value != null && f.value !== '';
	const valueLabel = (f: Field) =>
		f.type === 'number'
			? m.filter_up_to({ amount: formatINR(Number(f.value)) })
			: (f.options?.find((o) => o.value === f.value)?.label ?? String(f.value));
	/** The current URL's params minus `drop` (hidden inputs keep the other filters on submit). */
	const keep = (...drop: string[]) =>
		[...page.url.searchParams].filter(([k, v]) => v !== '' && !drop.includes(k));
	const without = (name: string) => {
		const q = new URLSearchParams(keep(name));
		return q.size ? `?${q}` : page.url.pathname;
	};
	function choose(f: Field) {
		current = f;
		dialog?.showModal();
	}
	const sortLabel = {
		best: m.sort_best,
		price_asc: m.sort_price_asc,
		price_desc: m.sort_price_desc
	};
	const pill = 'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 py-1 type-label';
</script>

<div
	class="sticky top-(--bar-h) z-map-ui -mx-5 flex flex-col gap-1 bg-bg px-5 pt-2 pb-1 lg:mx-0 lg:px-0"
>
	<div class="-mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-wrap lg:px-0" data-clip-check>
		{#each fields as f (f.name)}
			{#if set(f)}
				<!-- eslint-disable svelte/no-navigation-without-resolve -- same page, query only -->
				<a
					href={without(f.name)}
					class="inline-flex min-h-11 shrink-0 items-center no-underline"
					aria-label={`${f.label}: ${valueLabel(f)}. ${m.filter_clear({ filter: f.label })}`}
				>
					<span class={[pill, 'bg-text text-bg']}>
						{valueLabel(f)}<X size={16} aria-hidden="true" />
					</span>
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{:else}
				<button
					type="button"
					class="group inline-flex min-h-11 shrink-0 items-center"
					aria-haspopup="dialog"
					onclick={() => choose(f)}
				>
					<span class={[pill, 'bg-surface-2 text-text group-hover:bg-surface-3']}>
						{f.label}<ChevronDown size={16} aria-hidden="true" />
					</span>
				</button>
			{/if}
		{/each}
	</div>
	<div class="flex items-center justify-between gap-3">
		<p class="type-small text-text-2" aria-live="polite">{m.results_count({ n: count })}</p>
		<form method="GET" class="flex items-center gap-2">
			{#each keep('sort') as [k, v] (k)}<input type="hidden" name={k} value={v} />{/each}
			<label class="flex min-h-11 items-center gap-2 type-small text-text-2">
				{m.sort_label()}
				<select
					name="sort"
					value={sort}
					onchange={(e) => e.currentTarget.form?.requestSubmit()}
					class="field h-9 rounded-full px-3 type-label text-text"
				>
					{#each SORTS as s (s)}<option value={s}>{sortLabel[s]()}</option>{/each}
				</select>
			</label>
			<noscript><Button type="submit" variant="secondary">{m.apply_filters()}</Button></noscript>
		</form>
	</div>
</div>

<dialog
	bind:this={dialog}
	onclose={() => (current = null)}
	aria-labelledby="filter-title"
	class="mx-auto mt-auto mb-0 w-full max-w-none rounded-t-xl bg-surface p-5 pb-[calc(--spacing(5)+env(safe-area-inset-bottom))] text-text shadow-e3 backdrop:bg-(--scrim) lg:m-auto lg:max-w-105 lg:rounded-xl lg:pb-5"
>
	{#if current}
		<form method="GET" class="flex flex-col gap-4">
			<div class="flex items-center justify-between gap-2">
				<h2 id="filter-title" class="type-h2">{current.label}</h2>
				<IconButton label={m.close()} onclick={() => dialog?.close()}
					><X size={20} aria-hidden="true" /></IconButton
				>
			</div>
			{#each keep(current.name) as [k, v] (k)}<input type="hidden" name={k} value={v} />{/each}
			{#if current.options}
				<fieldset class="flex max-h-[50vh] flex-col overflow-y-auto">
					<legend class="sr-only">{current.label}</legend>
					{#each [{ value: '', label: m.filter_any() }, ...current.options] as o (o.value)}
						<label class="flex min-h-11 items-center gap-3 type-body">
							<input
								type="radio"
								name={current.name}
								value={o.value}
								checked={(current.value ?? '') === o.value}
								class="size-5 accent-(--kokum)"
							/>{o.label}
						</label>
					{/each}
				</fieldset>
			{:else}
				<label class="flex flex-col gap-1.5 type-small text-text-2">
					{current.label}
					<input
						name={current.name}
						type="number"
						min="0"
						step="100"
						inputmode="numeric"
						value={current.value ?? ''}
						class="field h-13 px-4 type-body text-text"
					/>
				</label>
			{/if}
			<Button type="submit">{m.apply_filters()}</Button>
		</form>
	{/if}
</dialog>
