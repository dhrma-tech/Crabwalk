<script lang="ts">
	import { submitting } from '#lib/forms.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { s } from '#lib/staff-messages.ts';
	import { msg } from '#lib/msg.ts';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const field = 'field h-12 w-28 px-3 type-body text-text';
</script>

<Page title={s.planner_settings()} back>
	{#if data.ready}
		<section
			class="mx-auto mb-4 flex max-w-170 flex-col gap-3 rounded-lg bg-surface p-4 shadow-e1"
			data-testid="planner-readiness"
		>
			<h2 class="type-h2">{s.planner_ready()}</h2>
			<p class="type-small text-text-2">{s.planner_ready_hint()}</p>
			<dl class="flex flex-col gap-2 type-body">
				{#each [[s.planner_ready_published(), data.ready.published], [s.planner_ready_no_matrix(), data.ready.no_matrix_point], [s.planner_ready_no_hours(), data.ready.no_hours], [s.planner_ready_no_seasonal(), data.ready.no_seasonal], [s.planner_ready_tide(), `${data.ready.tide_no_rule} / ${data.ready.tide_dependent}`]] as [label, n] (label)}
					<div class="flex items-center justify-between gap-3">
						<dt>{label}</dt>
						<dd class="tabular-nums">{n}</dd>
					</div>
				{/each}
			</dl>
		</section>
	{/if}
	<form method="POST" action="?/save" use:submitting class="mx-auto flex max-w-170 flex-col gap-4">
		<section class="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-e1">
			<h2 class="type-h2">{m.budget_fuel()}</h2>
			<p class="type-small text-text-2">{s.planner_fuel_hint()}</p>
			<label class="flex items-center justify-between gap-3 type-body"
				>{m.budget_fuel_price()}<input
					name="fuel_price_inr"
					type="number"
					step="0.01"
					min="0"
					value={data.fuelPrice ?? ''}
					class={field}
				/></label
			>
			<label class="flex items-center justify-between gap-3 type-body"
				>{m.budget_mileage()}<input
					name="default_mileage_kmpl"
					type="number"
					step="0.1"
					min="1"
					value={data.mileage ?? ''}
					class={field}
				/></label
			>
		</section>
		<section class="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-e1">
			<h2 class="type-h2">{s.planner_visit_minutes()}</h2>
			{#each data.cats as c (c.category)}
				<label class="flex items-center justify-between gap-3 type-body"
					>{msg(`cat_${c.category}`)}<input
						name="min_{c.category}"
						type="number"
						min="10"
						max="600"
						step="5"
						value={c.minutes}
						required
						class={field}
					/></label
				>
			{/each}
		</section>
		{#if form?.saved}<p class="type-small" role="status">{m.owner_saved()}</p>{/if}
		{#if form?.error}<p class="type-small" role="alert">{m.send_failed()}</p>{/if}
		<div><Button type="submit">{s.qr_admin_save()}</Button></div>
	</form>
</Page>
