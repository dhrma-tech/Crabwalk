<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { formatINR } from '#lib/format.ts';
	import Button from '../Button.svelte';

	// FRONTEND §7.9 budget card: stay/food/fuel/entry/activities, editable vehicle/mileage, per-person split.
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
	const num = 'h-11 w-28 border-b border-text bg-transparent type-body text-text';
</script>

<section class="flex flex-col gap-3 border-t border-text pt-3" data-testid="budget">
	<h2 class="type-h2">{m.plan_budget()}</h2>
	<dl class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 type-small [&>dt]:text-text-2">
		<dt>{m.budget_stay()}</dt>
		<dd class="text-right">{formatINR(budget.stay)}</dd>
		<dt>{m.budget_food()}</dt>
		<dd class="text-right">{formatINR(budget.food)}</dd>
		<dt>{m.budget_fuel()}</dt>
		<dd class="text-right">
			{budget.fuelMissing ? m.budget_fuel_missing() : formatINR(budget.fuel)}
		</dd>
		<dt>
			{m.budget_entry()}{budget.entryUnknown
				? ` (${m.budget_entry_unknown({ n: budget.entryUnknown })})`
				: ''}
		</dt>
		<dd class="text-right">{formatINR(budget.entry)}</dd>
		<dt>{m.budget_activities()}</dt>
		<dd class="text-right">{formatINR(budget.activities)}</dd>
		<dt class="border-t border-border pt-1.5 font-medium text-text!">{m.budget_total()}</dt>
		<dd class="border-t border-border pt-1.5 text-right font-medium" data-testid="budget-total">
			{formatINR(budget.total)}
		</dd>
		<dt>{m.budget_per_person({ n: budget.people })}</dt>
		<dd class="text-right" data-testid="budget-pp">{formatINR(budget.perPerson)}</dd>
	</dl>
	{#if editable}
		<form
			class="grid grid-cols-2 gap-3 print:hidden"
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
			<label class="flex flex-col gap-1 type-small text-text-2"
				>{m.plan_people()}<input
					type="number"
					min="1"
					max="50"
					bind:value={people}
					class={num}
				/></label
			>
			<label class="flex flex-col gap-1 type-small text-text-2"
				>{m.budget_fuel_price()}<input
					type="number"
					min="0"
					step="0.01"
					bind:value={fuelPrice}
					class={num}
				/></label
			>
			<label class="flex flex-col gap-1 type-small text-text-2"
				>{m.budget_mileage()}<input
					type="number"
					min="1"
					step="0.1"
					bind:value={mileage}
					class={num}
				/></label
			>
			<label class="flex flex-col gap-1 type-small text-text-2"
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
