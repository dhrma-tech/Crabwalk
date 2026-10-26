<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { formatINR } from '#lib/format.ts';
	import Button from '../Button.svelte';

	// FRONTEND §7.9 budget card: stay/food/fuel/entry/activities, editable vehicle/mileage, per-person split.
	// Tideline (Report 2 §9.8, T-32): a stacked bar per category above the same rows (the amounts stay as text,
	// so colour is never the only signal), total + per person, then the edit form.
	type B = {
		stay: number;
		food: number;
		fuel: number;
		entry: number;
		activities: number;
		people: number;
		fuel_price: number | null;
		vehicle_mileage_kmpl: number | null;
		total: number;
		perPerson: number;
		fuelMissing: boolean;
		entryUnknown: number;
	};
	let {
		budget,
		editable = false,
		onsave
	}: {
		budget: B;
		editable?: boolean;
		onsave?: (b: {
			people: number;
			fuel_price: number | null;
			vehicle_mileage_kmpl: number | null;
			activities: number;
		}) => void;
	} = $props();

	let people = $state(1);
	let fuelPrice = $state<number | null>(null);
	let mileage = $state<number | null>(null);
	let activities = $state(0);
	$effect(() => {
		people = budget.people;
		fuelPrice = budget.fuel_price;
		mileage = budget.vehicle_mileage_kmpl;
		activities = budget.activities;
	});
	const num = 'field h-12 w-full px-3 type-body text-text';
	const parts = $derived(
		(
			[
				['stay', budget.stay, 'bg-lagoon', m.budget_stay()],
				['food', budget.food, 'bg-alphonso', m.budget_food()],
				['fuel', budget.fuelMissing ? 0 : budget.fuel, 'bg-kokum', m.budget_fuel()],
				['entry', budget.entry, 'bg-laterite', m.budget_entry()],
				['activities', budget.activities, 'bg-text-2', m.budget_activities()]
			] as const
		).filter(([, v]) => v > 0)
	);
	const key = {
		stay: 'bg-lagoon',
		food: 'bg-alphonso',
		fuel: 'bg-kokum',
		entry: 'bg-laterite',
		activities: 'bg-text-2'
	};
	const sw = (c: string) => ['mr-2 inline-block size-2.5 rounded-full', c];
</script>

<section class="flex flex-col gap-4 rounded-lg bg-surface p-4 shadow-e1" data-testid="budget">
	<div class="flex items-baseline justify-between gap-3">
		<h2 class="type-h2">{m.plan_budget()}</h2>
		<p class="type-h2 tabular-nums">{formatINR(budget.total)}</p>
	</div>
	{#if parts.length}
		<div class="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
			{#each parts as [k, v, c] (k)}<span class={['h-full', c]} style:flex-grow={v}></span>{/each}
		</div>
	{/if}
	<dl class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 type-small [&>dt]:text-text-2">
		<dt><span class={sw(key.stay)}></span>{m.budget_stay()}</dt>
		<dd class="text-right tabular-nums">{formatINR(budget.stay)}</dd>
		<dt><span class={sw(key.food)}></span>{m.budget_food()}</dt>
		<dd class="text-right tabular-nums">{formatINR(budget.food)}</dd>
		<dt><span class={sw(key.fuel)}></span>{m.budget_fuel()}</dt>
		<dd class="text-right tabular-nums">
			{budget.fuelMissing ? m.budget_fuel_missing() : formatINR(budget.fuel)}
		</dd>
		<dt>
			<span class={sw(key.entry)}></span>{m.budget_entry()}{budget.entryUnknown
				? ` (${m.budget_entry_unknown({ n: budget.entryUnknown })})`
				: ''}
		</dt>
		<dd class="text-right tabular-nums">{formatINR(budget.entry)}</dd>
		<dt><span class={sw(key.activities)}></span>{m.budget_activities()}</dt>
		<dd class="text-right tabular-nums">{formatINR(budget.activities)}</dd>
		<div class="col-span-2 my-1 border-t border-border" role="presentation"></div>
		<dt class="type-body-strong text-text!">{m.budget_total()}</dt>
		<dd class="text-right type-body-strong tabular-nums" data-testid="budget-total">
			{formatINR(budget.total)}
		</dd>
		<dt>{m.budget_per_person({ n: budget.people })}</dt>
		<dd class="text-right type-body-strong tabular-nums" data-testid="budget-pp">
			{formatINR(budget.perPerson)}
		</dd>
	</dl>
	{#if editable}
		<form
			class="grid grid-cols-2 gap-3 border-t border-border pt-4 print:hidden"
			onsubmit={(e) => {
				e.preventDefault();
				onsave?.({
					people,
					fuel_price: fuelPrice || null,
					vehicle_mileage_kmpl: mileage || null,
					activities: activities || 0
				});
			}}
		>
			<label class="flex flex-col gap-1.5 type-small text-text-2"
				>{m.plan_people()}<input
					type="number"
					min="1"
					max="50"
					bind:value={people}
					class={num}
				/></label
			>
			<label class="flex flex-col gap-1.5 type-small text-text-2"
				>{m.budget_fuel_price()}<input
					type="number"
					min="0"
					step="0.01"
					bind:value={fuelPrice}
					class={num}
				/></label
			>
			<label class="flex flex-col gap-1.5 type-small text-text-2"
				>{m.budget_mileage()}<input
					type="number"
					min="1"
					step="0.1"
					bind:value={mileage}
					class={num}
				/></label
			>
			<label class="flex flex-col gap-1.5 type-small text-text-2"
				>{m.budget_activities()}<input
					type="number"
					min="0"
					step="100"
					bind:value={activities}
					class={num}
				/></label
			>
			<div class="col-span-2">
				<Button type="submit" variant="secondary">{m.budget_update()}</Button>
			</div>
		</form>
	{/if}
</section>
